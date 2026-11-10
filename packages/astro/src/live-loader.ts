import type { LiveLoader } from 'astro/loaders'
import { entryId, toEntryData, type PostData } from './entry.ts'
import { collectPosts, isVisible, toRendered, type PostrLiveLoaderOptions } from './loader.ts'
import { openSource, type EntryLookup, type PostSource, type SourceItem } from './source.ts'

export type PostEntryFilter = EntryLookup

export interface PostCollectionFilter {
  /** Overrides the loader's `postType`. */
  postType?: string
  /** Overrides the loader's `category`. */
  category?: string
  /** Full-text search of name, summary, content and category. */
  search?: string
  limit?: number
  offset?: number
}

function toLiveEntry(post: SourceItem) {
  const id = entryId(post.path)
  const data = toEntryData(post)
  const rendered = toRendered(data)
  return {
    id,
    data,
    ...(rendered && { rendered }),
    cacheHint: { tags: ['postr', `postr:${id}`], lastModified: data.updated },
  }
}

const failure = (message: string, err: unknown) => ({
  error: new Error(`postr: ${message}: ${(err as Error).message}`, { cause: err }),
})

/** Live loader for `src/live.config.ts`: reads posts on every request. */
export function postrLiveLoader(
  options: PostrLiveLoaderOptions
): LiveLoader<PostData, PostEntryFilter, PostCollectionFilter> {
  let source: PostSource | undefined
  const getSource = () => (source ??= openSource(options))
  const visibilities = options.visibility ?? ['public']

  return {
    name: 'postr-live-loader',
    async loadCollection({ filter = {} }) {
      try {
        const posts = await collectPosts(
          getSource(),
          options,
          {
            postType: filter.postType ?? options.postType,
            category: filter.category ?? options.category,
            search: filter.search,
          },
          { limit: filter.limit, offset: filter.offset }
        )
        const entries = posts.map(toLiveEntry)
        const lastModified = entries.reduce<Date | undefined>(
          (latest, entry) => (!latest || entry.data.updated > latest ? entry.data.updated : latest),
          undefined
        )
        return { entries, cacheHint: { tags: ['postr'], ...(lastModified && { lastModified }) } }
      } catch (err) {
        return failure('loading posts failed', err)
      }
    },
    async loadEntry({ filter }) {
      try {
        const post = await getSource().get(filter)
        if (!post || !isVisible(post, visibilities, options.drafts)) return undefined
        return toLiveEntry(post)
      } catch (err) {
        return failure('loading a post failed', err)
      }
    },
  }
}
