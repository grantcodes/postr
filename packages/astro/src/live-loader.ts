import type { LiveLoader } from 'astro/loaders'
import { entryId, toEntryData, type PostData } from './entry.ts'
import {
  collectPosts,
  countPosts,
  isVisible,
  toRendered,
  type PostrLiveLoaderOptions,
} from './loader.ts'
import {
  openSource,
  type EntryLookup,
  type PostSource,
  type PublishedRange,
  type SourceItem,
} from './source.ts'

export type PostEntryFilter = EntryLookup

export interface PostCollectionFilter {
  /** Overrides the loader's `postType`. */
  postType?: string
  /** Overrides the loader's `category`. */
  category?: string
  /** Full-text search of name, summary, content and category. */
  search?: string
  /** Only posts published in this range: `from` inclusive, `to` exclusive. */
  published?: PublishedRange
  limit?: number
  offset?: number
}

export type PostCountFilter = Omit<PostCollectionFilter, 'limit' | 'offset'>

export type PostrLiveLoader = LiveLoader<PostData, PostEntryFilter, PostCollectionFilter> & {
  /** Number of posts `loadCollection` returns for the filter without `limit` and `offset`. */
  count(filter?: PostCountFilter): Promise<number>
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
export function postrLiveLoader(options: PostrLiveLoaderOptions): PostrLiveLoader {
  let source: PostSource | undefined
  const getSource = () => (source ??= openSource(options))
  const visibilities = options.visibility ?? ['public']
  const toQuery = (filter: PostCountFilter) => ({
    postType: filter.postType ?? options.postType,
    category: filter.category ?? options.category,
    search: filter.search,
    published: filter.published,
  })

  return {
    name: 'postr-live-loader',
    async loadCollection({ filter = {} }) {
      try {
        const posts = await collectPosts(getSource(), options, toQuery(filter), {
          limit: filter.limit,
          offset: filter.offset,
        })
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
    count: (filter = {}) => countPosts(getSource(), options, toQuery(filter)),
  }
}
