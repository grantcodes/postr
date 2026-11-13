import {
  firstString,
  toPostView,
  type Mf2Item,
  type Mf2Properties,
  type PostView,
} from '@postr/core'
import { z } from 'astro/zod'
import type { SourceItem } from './source.ts'

const isObject = (value: unknown) => typeof value === 'object' && value !== null

/**
 * Schema of `entry.data`: core's `PostView` plus the loader's fields. Extend it with
 * `postSchema.extend({...})` for a custom collection schema.
 */
export const postSchema = z.object({
  url: z.string(),
  /** Permalink path, e.g. `/2026/06/04/hello`. */
  path: z.string(),
  /** mf2 type, e.g. `h-entry`. */
  type: z.string(),
  postType: z.string(),
  name: z.string().optional(),
  summary: z.string().optional(),
  content: z.object({ html: z.string(), text: z.string() }).optional(),
  published: z.coerce.date(),
  updated: z.coerce.date(),
  status: z.enum(['published', 'draft']),
  visibility: z.enum(['public', 'unlisted', 'private']),
  categories: z.array(z.string()),
  photos: z.array(
    z.object({
      url: z.string(),
      alt: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      /** Resized copies by `imageSizes` name. */
      sizes: z
        .record(z.string(), z.object({ url: z.string(), width: z.number(), height: z.number() }))
        .optional(),
    })
  ),
  videos: z.array(z.string()),
  audio: z.array(z.string()),
  featured: z.string().optional(),
  inReplyTo: z.array(z.string()),
  likeOf: z.array(z.string()),
  repostOf: z.array(z.string()),
  bookmarkOf: z.array(z.string()),
  syndication: z.array(z.string()),
  /** URLs of the posts in a collection (mf2 `children`). */
  children: z.array(z.string()),
  /** Fetched h-entries of the URLs the post responds to, keyed by URL. Empty over HTTP. */
  references: z.custom<Record<string, Mf2Item>>(isObject),
  /** The full mf2 properties, as returned by `q=source`. */
  properties: z.custom<Mf2Properties>(isObject),
})

export type PostData = z.infer<typeof postSchema>

type EntryShape = PostView &
  Pick<SourceItem, 'url' | 'path' | 'postType' | 'references'> & {
    properties: Mf2Properties
  }

/** Fails to compile when `postSchema` and core's `PostView` drift apart. */
type SchemaMatchesPostView = [PostData] extends [EntryShape]
  ? [EntryShape] extends [PostData]
    ? true
    : never
  : never
true satisfies SchemaMatchesPostView

/** Projects a source item onto the entry shape. */
export function toEntryData({ item, url, path, postType, references }: SourceItem): PostData {
  return {
    ...toPostView(item),
    url,
    path,
    postType,
    references,
    properties: item.properties,
  }
}

export function visibility(item: Mf2Item): PostData['visibility'] {
  const value = firstString(item.properties, 'visibility')
  return value === 'unlisted' || value === 'private' ? value : 'public'
}

export const isDraft = (item: Mf2Item) => firstString(item.properties, 'post-status') === 'draft'

/** Entry id: the permalink path without its leading slash. */
export const entryId = (path: string) => path.replace(/^\/+/, '')
