import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm'
import type { Database } from '../db/index.ts'
import { postRefs, posts, refs, type PostRow } from '../db/schema.ts'
import { PostrError } from '../errors.ts'
import {
  mf2InputSchema,
  mf2UpdateSchema,
  type Mf2Input,
  type Mf2Item,
  type Mf2Properties,
  type Mf2Update,
} from '../mf2.ts'
import type { SaveAction, SaveEvent } from '../plugins.ts'
import { getLinks } from './links.ts'
import { normalizePost, type NormalizedPost } from './normalize.ts'
import { buildPath } from './permalink.ts'
import type { PostTypeDefinition } from './post-type.ts'

export interface Post extends NormalizedPost {
  id: string
  /** Permalink: `siteUrl + path`. */
  url: string
  path: string
  deletedAt: string | null
}

export interface ListOptions {
  limit?: number
  offset?: number
  /** `desc` (newest first) by default. */
  order?: 'asc' | 'desc'
  postType?: string
  category?: string
  /** Only posts that have all of these properties. */
  exists?: string[]
  /** Only posts that have none of these properties. */
  notExists?: string[]
  /** Only posts where each property contains the given value. */
  properties?: Record<string, string>
  /** Include drafts and unlisted/private posts. Deleted posts are never listed. */
  includeHidden?: boolean
}

export interface WriteOptions {
  /** Recorded on the save event; anything other than `user` skips built-in side effects. */
  origin?: string
}

/** Lets imports keep a post's existing identity. */
export interface CreateOptions extends WriteOptions {
  id?: string
  /** Exact permalink path to use instead of the pattern; fails if another post has it. */
  path?: string
  deletedAt?: string
}

export interface PostServiceDeps {
  db: Database
  siteUrl: string
  permalinkPattern: string
  formatContent: boolean
  postTypes: () => PostTypeDefinition[]
  beforeSave: (item: Mf2Item, action: 'create' | 'update', previous?: Post) => Promise<Mf2Item>
  afterSave: (event: SaveEvent) => Promise<void>
}

const propertyPath = (key: string) => `$."${key.replaceAll('"', '')}"`

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createPostService(deps: PostServiceDeps) {
  const { db, siteUrl } = deps

  function toPost(row: PostRow): Post {
    return {
      ...row,
      children: row.children ?? null,
      url: siteUrl + row.path,
    }
  }

  /** The full mf2 representation, including the column-backed properties and permalink. */
  function toMf2(post: Post): Mf2Item {
    const urls = [...(post.url ? [post.url] : []), ...(post.properties.url ?? [])]
    const properties: Mf2Properties = {
      ...post.properties,
      ...(urls.length ? { url: urls } : {}),
      published: [post.published],
      updated: [post.updated],
      'post-status': [post.status],
      visibility: [post.visibility],
    }
    return {
      type: [post.type],
      properties,
      ...(post.children ? { children: post.children } : {}),
    }
  }

  async function get(id: string): Promise<Post | undefined> {
    const [row] = await db.select().from(posts).where(eq(posts.id, id))
    return row && toPost(row)
  }

  /** Finds a post by its permalink (query string, fragment and trailing slash are ignored). */
  async function getByUrl(url: string, { includeDeleted = false } = {}): Promise<Post | undefined> {
    if (!url.startsWith(siteUrl)) return undefined
    const path = url.slice(siteUrl.length).replace(/[?#].*$/, '')
    const candidates = [path, path.replace(/\/$/, ''), `${path}/`].filter(Boolean)
    const [row] = await db
      .select()
      .from(posts)
      .where(
        and(inArray(posts.path, candidates), includeDeleted ? undefined : isNull(posts.deletedAt))
      )
    return row && toPost(row)
  }

  async function find(urlOrId: string): Promise<Post> {
    const post = URL.canParse(urlOrId)
      ? await getByUrl(urlOrId, { includeDeleted: true })
      : await get(urlOrId)
    if (!post) throw new PostrError('not_found', `Post not found: ${urlOrId}`)
    return post
  }

  async function uniquePath(post: NormalizedPost, id: string) {
    let slug = post.slug
    for (let i = 1; ; i++) {
      const path = buildPath(deps.permalinkPattern, post.published, slug)
      const [conflict] = await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.path, path), ne(posts.id, id)))
      if (!conflict) return { slug, path }
      slug = `${post.slug}-${i}`
    }
  }

  async function prepare(item: Mf2Item, action: 'create' | 'update', previous?: Post) {
    const options = {
      siteUrl,
      formatContent: deps.formatContent,
      postTypes: deps.postTypes(),
      now: new Date(),
      slug: previous?.slug,
    }
    const first = normalizePost(item, options)
    const hooked = await deps.beforeSave(
      toMf2({ ...first.post, id: '', url: '', path: '', deletedAt: null }),
      action,
      previous
    )
    const { post } = normalizePost(hooked, { ...options, slug: first.post.slug })
    return { post, commands: first.commands }
  }

  async function write(
    id: string,
    post: NormalizedPost,
    previous: Post | undefined,
    deletedAt: string | null,
    fixedPath?: string
  ): Promise<Post> {
    const unchangedPath =
      previous &&
      previous.slug === post.slug &&
      previous.published.slice(0, 10) === post.published.slice(0, 10)
    const { slug, path } = unchangedPath
      ? { slug: previous.slug, path: previous.path }
      : fixedPath
        ? { slug: post.slug, path: fixedPath }
        : await uniquePath(post, id)
    if (fixedPath) {
      const [conflict] = await db.select({ id: posts.id }).from(posts).where(eq(posts.path, path))
      if (conflict) throw new PostrError('invalid_request', `Path already in use: ${path}`)
    }
    const row: PostRow = { ...post, id, slug, path, deletedAt }

    const links = getLinks(post.properties, siteUrl)
    db.transaction((tx) => {
      if (previous) tx.update(posts).set(row).where(eq(posts.id, id)).run()
      else tx.insert(posts).values(row).run()
      tx.delete(postRefs).where(eq(postRefs.postId, id)).run()
      if (links.length) {
        tx.insert(postRefs)
          .values(links.map((link) => ({ postId: id, ...link })))
          .run()
      }
    })
    return toPost(row)
  }

  async function emit(
    action: SaveAction,
    post: Post,
    previous: Post | undefined,
    commands: Mf2Properties,
    options: WriteOptions
  ) {
    await deps.afterSave({
      action,
      post,
      previous,
      commands,
      origin: options.origin ?? 'user',
    })
    return post
  }

  async function create(input: Mf2Input, options: CreateOptions = {}) {
    const parsed = mf2InputSchema.safeParse(input)
    if (!parsed.success) {
      throw new PostrError('invalid_request', `Invalid post: ${parsed.error.message}`)
    }
    const id = options.id ?? randomUUID()
    if (options.id && (await get(options.id))) {
      throw new PostrError('invalid_request', `Post id already in use: ${id}`)
    }
    const { post, commands } = await prepare(parsed.data, 'create')
    const saved = await write(id, post, undefined, options.deletedAt ?? null, options.path)
    return emit('create', saved, undefined, commands, options)
  }

  /** Applies a Micropub update (`replace`, `add`, `delete`) to a post. */
  async function update(urlOrId: string, changes: Mf2Update, options: WriteOptions = {}) {
    const parsed = mf2UpdateSchema.safeParse(changes)
    if (!parsed.success) {
      throw new PostrError('invalid_request', `Invalid update: ${parsed.error.message}`)
    }
    const previous = await find(urlOrId)
    const item = toMf2(previous)
    const properties = item.properties
    delete properties.updated
    properties.url = previous.properties.url ?? []

    const { replace = {}, add = {}, delete: remove } = parsed.data
    for (const [key, values] of Object.entries(replace)) properties[key] = values
    // Delete before add, so one update can swap a value for a new version of it.
    if (Array.isArray(remove)) {
      for (const key of remove) delete properties[key]
    } else if (remove) {
      for (const [key, values] of Object.entries(remove)) {
        const kept = (properties[key] ?? []).filter(
          (value) => !values.some((v) => sameValue(v, value))
        )
        if (kept.length) properties[key] = kept
        else delete properties[key]
      }
    }
    for (const [key, values] of Object.entries(add)) {
      properties[key] = [...(properties[key] ?? []), ...values]
    }

    const { post, commands } = await prepare(item, 'update', previous)
    const saved = await write(previous.id, post, previous, previous.deletedAt)
    return emit('update', saved, previous, commands, options)
  }

  async function setDeleted(urlOrId: string, deleted: boolean, options: WriteOptions) {
    const previous = await find(urlOrId)
    const deletedAt = deleted ? new Date().toISOString() : null
    await db.update(posts).set({ deletedAt }).where(eq(posts.id, previous.id))
    const post = { ...previous, deletedAt }
    return emit(deleted ? 'delete' : 'undelete', post, previous, {}, options)
  }

  async function list(options: ListOptions = {}): Promise<Post[]> {
    const conditions: Array<SQL | undefined> = [isNull(posts.deletedAt)]
    if (!options.includeHidden) {
      conditions.push(eq(posts.status, 'published'), eq(posts.visibility, 'public'))
    }
    if (options.postType) conditions.push(eq(posts.postType, options.postType))
    const contains = (key: string, value: string) =>
      sql`exists (select 1 from json_each(${posts.properties}, ${propertyPath(key)}) where value = ${value})`
    if (options.category) conditions.push(contains('category', options.category))
    for (const [key, value] of Object.entries(options.properties ?? {})) {
      conditions.push(contains(key, value))
    }
    for (const key of options.exists ?? []) {
      conditions.push(sql`json_type(${posts.properties}, ${propertyPath(key)}) is not null`)
    }
    for (const key of options.notExists ?? []) {
      conditions.push(sql`json_type(${posts.properties}, ${propertyPath(key)}) is null`)
    }
    const order = options.order === 'asc' ? asc : desc
    const rows = await db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(order(posts.publishedAt), order(posts.id))
      .limit(options.limit ?? 20)
      .offset(options.offset ?? 0)
    return rows.map(toPost)
  }

  /** Every category used by a published post, sorted. */
  async function categories(): Promise<string[]> {
    const rows = await db.all<{ value: string }>(sql`
      select distinct c.value as value
      from ${posts}, json_each(${posts.properties}, '$.category') as c
      where ${posts.deletedAt} is null and ${posts.status} = 'published' and c.type = 'text'
      order by c.value`)
    return rows.map((row) => row.value)
  }

  /** Cached h-entry snapshots of the URLs a post responds to, keyed by URL. */
  async function references(post: Post): Promise<Record<string, Mf2Item>> {
    const rows = await db
      .select({ url: refs.url, entry: refs.entry })
      .from(postRefs)
      .innerJoin(refs, eq(refs.url, postRefs.url))
      .where(eq(postRefs.postId, post.id))
    const result: Record<string, Mf2Item> = {}
    for (const { url, entry } of rows) if (entry) result[url] = entry
    return result
  }

  return {
    create,
    update,
    delete: (urlOrId: string, options: WriteOptions = {}) => setDeleted(urlOrId, true, options),
    undelete: (urlOrId: string, options: WriteOptions = {}) => setDeleted(urlOrId, false, options),
    get,
    getByUrl,
    list,
    categories,
    references,
    toMf2,
  }
}

export type PostService = ReturnType<typeof createPostService>
