import {
  firstString,
  htmlToText,
  urlValues,
  type Mf2Item,
  type Mf2Properties,
  type Mf2Value,
} from '@postr/core'
import { z } from 'astro/zod'
import type { SourceItem } from './source.ts'

const isObject = (value: unknown) => typeof value === 'object' && value !== null

/** Schema of `entry.data`. Extend it with `postSchema.extend({...})` for a custom collection schema. */
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
  photos: z.array(z.object({ url: z.string(), alt: z.string().optional() })),
  videos: z.array(z.string()),
  audio: z.array(z.string()),
  featured: z.string().optional(),
  inReplyTo: z.array(z.string()),
  likeOf: z.array(z.string()),
  repostOf: z.array(z.string()),
  bookmarkOf: z.array(z.string()),
  syndication: z.array(z.string()),
  /** Fetched h-entries of the URLs the post responds to, keyed by URL. Empty over HTTP. */
  references: z.custom<Record<string, Mf2Item>>(isObject),
  /** The full mf2 properties, as returned by `q=source`. */
  properties: z.custom<Mf2Properties>(isObject),
})

export type PostData = z.infer<typeof postSchema>

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

function mediaUrl(value: Mf2Value): string | undefined {
  if (typeof value === 'string') return value
  if (isObject(value) && typeof value.value === 'string') return value.value
  return undefined
}

const mediaUrls = (properties: Mf2Properties, key: string) =>
  (properties[key] ?? []).map(mediaUrl).filter((url) => url !== undefined)

function content(properties: Mf2Properties): PostData['content'] {
  const value = properties.content?.[0]
  if (typeof value === 'string') return { html: `<p>${escapeHtml(value)}</p>`, text: value }
  if (!isObject(value)) return undefined
  const html = typeof value.html === 'string' ? value.html : undefined
  const text = typeof value.value === 'string' ? value.value : undefined
  if (html !== undefined) return { html, text: text ?? htmlToText(html) }
  if (text !== undefined) return { html: `<p>${escapeHtml(text)}</p>`, text }
  return undefined
}

/** Projects a source item onto the friendly entry shape. */
export function toEntryData({ item, url, path, postType, references }: SourceItem): PostData {
  const { properties } = item
  const body = content(properties)
  const summary = firstString(properties, 'summary')
  const featured = firstString(properties, 'featured')
  const published = firstString(properties, 'published')
  let name = firstString(properties, 'name')
  // mf2 parsers imply a name from the text; it is not a real title when it repeats the content.
  if (name && body && name.trim().toLowerCase() === body.text.trim().toLowerCase()) {
    name = undefined
  }
  return {
    url,
    path,
    type: item.type[0] ?? 'h-entry',
    postType,
    ...(name !== undefined && { name }),
    ...(summary !== undefined && { summary }),
    ...(body && { content: body }),
    published: new Date(published ?? 0),
    updated: new Date(firstString(properties, 'updated') ?? published ?? 0),
    status: isDraft(item) ? 'draft' : 'published',
    visibility: visibility(item),
    categories: (properties.category ?? []).filter((value) => typeof value === 'string'),
    photos: (properties.photo ?? []).flatMap((value) => {
      const photoUrl = mediaUrl(value)
      if (!photoUrl) return []
      const alt = isObject(value) && typeof value.alt === 'string' ? value.alt : undefined
      return [alt === undefined ? { url: photoUrl } : { url: photoUrl, alt }]
    }),
    videos: mediaUrls(properties, 'video'),
    audio: mediaUrls(properties, 'audio'),
    ...(featured !== undefined && { featured }),
    inReplyTo: urlValues(properties, 'in-reply-to'),
    likeOf: urlValues(properties, 'like-of'),
    repostOf: urlValues(properties, 'repost-of'),
    bookmarkOf: urlValues(properties, 'bookmark-of'),
    syndication: urlValues(properties, 'syndication'),
    references,
    properties,
  }
}

export function visibility(item: Mf2Item): PostData['visibility'] {
  const value = firstString(item.properties, 'visibility')
  return value === 'unlisted' || value === 'private' ? value : 'public'
}

export const isDraft = (item: Mf2Item) => firstString(item.properties, 'post-status') === 'draft'

/** Entry id: the permalink path without its leading slash. */
export const entryId = (path: string) => path.replace(/^\/+/, '')
