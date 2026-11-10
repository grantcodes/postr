import type { PostVisibility } from '@postr/core'
import type { Loader, LoaderContext } from 'astro/loaders'
import { entryId, isDraft, postSchema, toEntryData, visibility } from './entry.ts'
import {
  openSource,
  type PostSource,
  type SourceItem,
  type SourceOptions,
  type SourceQuery,
} from './source.ts'

export interface PostFilterOptions {
  /** Only posts of this type, e.g. `note`. */
  postType?: string
  /** Only posts in this category. */
  category?: string
  /** Visibilities to include. Default `['public']`. */
  visibility?: PostVisibility[]
  /** Include drafts. Default `false`. */
  drafts?: boolean
}

export type PostrLiveLoaderOptions = SourceOptions & PostFilterOptions

export type PostrLoaderOptions = PostrLiveLoaderOptions & {
  /**
   * What a failed sync does: `throw` fails the build, `warn` logs and keeps the previous
   * entries. Default `warn` in `astro dev`, `throw` otherwise.
   */
  onError?: 'throw' | 'warn'
}

const pageSize = 100

/** Every post the options allow, newest first, skipping `offset` and stopping after `limit`. */
export async function collectPosts(
  source: PostSource,
  options: PostFilterOptions,
  query: SourceQuery,
  { limit = Infinity, offset = 0 } = {}
): Promise<SourceItem[]> {
  const visibilities = options.visibility ?? ['public']
  const results: SourceItem[] = []
  let skipped = 0
  for (let sourceOffset = 0; results.length < limit; sourceOffset += pageSize) {
    const page = await source.list(query, pageSize, sourceOffset)
    for (const post of page.items) {
      if (!isVisible(post, visibilities, options.drafts)) continue
      if (skipped < offset) skipped++
      else if (results.length < limit) results.push(post)
    }
    if (!page.more) break
  }
  return results
}

export function isVisible(post: SourceItem, visibilities: PostVisibility[], drafts = false) {
  return (drafts || !isDraft(post.item)) && visibilities.includes(visibility(post.item))
}

/** HTML for `render(entry)`; undefined for posts without content. */
export function toRendered(data: ReturnType<typeof toEntryData>) {
  return data.content && { html: data.content.html }
}

/** Annotated so the declaration names `typeof postSchema` instead of inlining `zod` types. */
export type PostrLoader = Loader & { schema: typeof postSchema }

/** Build-time content loader for `src/content.config.ts`. */
export function postrLoader(options: PostrLoaderOptions): PostrLoader {
  const query = { postType: options.postType, category: options.category }
  return {
    name: 'postr-loader',
    schema: postSchema,
    async load(context: LoaderContext) {
      const { store, logger } = context
      let posts: SourceItem[]
      try {
        const source = openSource(options)
        try {
          posts = await collectPosts(source, options, query)
        } finally {
          source.close()
        }
      } catch (err) {
        if ((options.onError ?? (context.watcher ? 'warn' : 'throw')) === 'throw') {
          throw new Error(`postr: sync failed: ${(err as Error).message}`, { cause: err })
        }
        logger.warn(`Sync failed, keeping the previous entries: ${(err as Error).message}`)
        return
      }

      const seen = new Set<string>()
      for (const post of posts) {
        const id = entryId(post.path)
        seen.add(id)
        const digest = context.generateDigest({
          item: post.item,
          path: post.path,
          postType: post.postType,
          references: post.references,
        })
        if (store.get(id)?.digest === digest) continue
        const entry = toEntryData(post)
        const data = await context.parseData({ id, data: entry })
        const rendered = toRendered(entry)
        store.set({ id, data, digest, ...(rendered && { rendered }) })
      }
      for (const id of store.keys()) if (!seen.has(id)) store.delete(id)
      logger.info(`Synced ${seen.size} posts`)
    },
  } satisfies Loader
}
