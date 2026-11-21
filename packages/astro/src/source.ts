import {
  createPostr,
  discoverPostType,
  firstString,
  type Mf2Item,
  type Postr,
  type PostTypeDefinition,
  type PostVisibility,
} from '@postr/core'

/** Where the loader reads posts from. */
export type SourceOptions =
  | {
      /** An existing postr instance, e.g. the one serving Micropub. */
      postr: Pick<Postr, 'posts' | 'siteUrl'>
    }
  | {
      /** Path of an existing, migrated postr SQLite database, opened read-only. */
      database: string
      siteUrl: string
    }
  | {
      /** Micropub endpoint of a running postr server, read with `q=source`. */
      endpoint: string
      token: string
      /** Defaults to the endpoint's origin. */
      siteUrl?: string
      fetch?: typeof fetch
      /** Custom post types the server uses, for post type discovery. */
      postTypes?: PostTypeDefinition[]
    }

/** A `published` range: `from` inclusive, `to` exclusive. */
export interface PublishedRange {
  from?: string | Date
  to?: string | Date
}

export interface SourceQuery {
  postType?: string
  category?: string
  search?: string
  published?: PublishedRange
  /** Visibilities to include; every one when omitted. */
  visibility?: PostVisibility[]
  /** Include drafts. */
  drafts?: boolean
}

/** A post as read from a source: full mf2 plus what the projection needs. */
export interface SourceItem {
  item: Mf2Item
  url: string
  path: string
  postType: string
  references: Record<string, Mf2Item>
}

export type EntryLookup = { id: string } | { url: string }

export interface PostSource {
  /**
   * One page, newest first. Sources with `count()` apply every query filter; others may
   * return posts outside `visibility` and `drafts`, which callers filter out.
   */
  list(
    query: SourceQuery,
    limit: number,
    offset: number
  ): Promise<{ items: SourceItem[]; more: boolean }>
  /** Number of posts `list()` returns for the query, without loading them. */
  count?(query: SourceQuery): Promise<number>
  get(lookup: EntryLookup): Promise<SourceItem | undefined>
  close(): void
}

const silent = { info() {}, warn() {}, error() {} }

function postrSource(postr: Pick<Postr, 'posts' | 'siteUrl'>, close = () => {}): PostSource {
  const { posts, siteUrl } = postr
  const toItem = async (post: Awaited<ReturnType<typeof posts.list>>[number]) => ({
    item: posts.toMf2(post),
    url: post.url,
    path: post.path,
    postType: post.postType,
    references: await posts.references(post),
  })
  const toListOptions = ({ drafts, ...query }: SourceQuery) => ({
    ...query,
    includeHidden: true,
    ...(!drafts && { status: 'published' as const }),
  })
  return {
    async list(query, limit, offset) {
      const page = await posts.list({ ...toListOptions(query), limit, offset })
      return { items: await Promise.all(page.map(toItem)), more: page.length === limit }
    },
    count: (query) => posts.count(toListOptions(query)),
    async get(lookup) {
      const url = 'url' in lookup ? lookup.url : `${siteUrl}/${lookup.id}`
      const post = await posts.getByUrl(url)
      return post && toItem(post)
    },
    close,
  }
}

function httpSource(options: Extract<SourceOptions, { endpoint: string }>): PostSource {
  const fetchFn = options.fetch ?? fetch
  const endpoint = URL.parse(options.endpoint)
  if (!endpoint) throw new TypeError(`postr: invalid endpoint ${options.endpoint}`)
  const siteUrl = (options.siteUrl ?? endpoint.origin).replace(/\/$/, '')
  const base = endpoint.origin + endpoint.pathname
  const baseQuery = endpoint.search

  function request(params: Record<string, string | undefined>) {
    const query = new URLSearchParams(baseQuery)
    query.set('q', 'source')
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, value)
    }
    return fetchFn(`${base}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${options.token}`, Accept: 'application/json' },
    })
  }

  function failed(response: Response): never {
    throw new Error(`GET ${options.endpoint}?q=source returned ${response.status}`)
  }

  function toItem(item: Mf2Item): SourceItem {
    const url = item.properties.url?.find((value) => typeof value === 'string') ?? ''
    const path = url.startsWith(siteUrl)
      ? url.slice(siteUrl.length)
      : (URL.parse(url)?.pathname ?? url)
    return {
      item,
      url,
      path,
      postType: discoverPostType(item, options.postTypes),
      references: {},
    }
  }

  const iso = (value?: string | Date) => value && new Date(value).toISOString()

  return {
    async list(query, limit, offset) {
      const from = iso(query.published?.from)
      const to = iso(query.published?.to)
      const response = await request({
        limit: String(limit),
        after: offset ? String(offset) : undefined,
        'post-type': query.postType,
        'property-category': query.category,
        search: query.search,
        'published-from': from,
        'published-to': to,
      })
      if (!response.ok) failed(response)
      const body = (await response.json()) as { items?: Mf2Item[]; paging?: { after?: string } }
      // Servers older than `published-from`/`published-to` ignore them.
      const inRange = (item: Mf2Item) => {
        const time = Date.parse(firstString(item.properties, 'published') ?? '')
        return !(from && time < Date.parse(from)) && !(to && time >= Date.parse(to))
      }
      const items = (body.items ?? []).filter(inRange).map(toItem)
      return { items, more: Boolean(body.paging?.after) }
    },
    async get(lookup) {
      const url = 'url' in lookup ? lookup.url : `${siteUrl}/${lookup.id}`
      const response = await request({ url })
      // postr answers an unknown post URL with 400 invalid_request.
      if (response.status === 400 || response.status === 404) return undefined
      if (!response.ok) failed(response)
      return toItem((await response.json()) as Mf2Item)
    },
    close() {},
  }
}

/** Opens the configured source. Close it when done; a passed postr instance is left open. */
export function openSource(options: SourceOptions): PostSource {
  if ('postr' in options) return postrSource(options.postr)
  if ('database' in options) {
    const postr = createPostr({
      siteUrl: options.siteUrl,
      endpointUrl: `${options.siteUrl.replace(/\/$/, '')}/micropub`,
      database: options.database,
      readOnly: true,
      runJobs: false,
      auth: { verify: async () => null },
      logger: silent,
    })
    return postrSource(postr, () => postr.close())
  }
  return httpSource(options)
}
