import { firstString, urlValues, type Mf2Item, type Mf2Properties, type Mf2Value } from '../mf2.ts'
import { htmlToText } from './content.ts'
import type { PostStatus, PostVisibility } from './normalize.ts'

export interface PostContent {
  html: string
  text: string
}

export interface PhotoSize {
  url: string
  width: number
  height: number
}

export interface PhotoView {
  url: string
  alt?: string
  width?: number
  height?: number
  /** Resized copies by `imageSizes` name. */
  sizes?: Record<string, PhotoSize>
}

/** A post's mf2 projected onto the fields templates and feeds need. */
export interface PostView {
  /** mf2 type, e.g. `h-entry`. */
  type: string
  /** Omitted when it only repeats the content, as mf2 parsers imply names from text. */
  name?: string
  summary?: string
  content?: PostContent
  published: Date
  updated: Date
  status: PostStatus
  visibility: PostVisibility
  /** Category names; person tags (h-cards) are left out. */
  categories: string[]
  /** `width`, `height` and resized `sizes` are set for images in the local media store. */
  photos: PhotoView[]
  videos: string[]
  audio: string[]
  featured?: string
  inReplyTo: string[]
  likeOf: string[]
  repostOf: string[]
  bookmarkOf: string[]
  syndication: string[]
  /** URLs of the posts in a collection (mf2 `children`). */
  children: string[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** HTML and text of one `content` value; plain text is escaped into a paragraph. */
export function contentValue(value: Mf2Value | undefined): PostContent | undefined {
  if (typeof value === 'string') return { html: `<p>${escapeHtml(value)}</p>`, text: value }
  if (!isObject(value)) return undefined
  const html = typeof value.html === 'string' ? value.html : undefined
  const text = typeof value.value === 'string' ? value.value : undefined
  if (html !== undefined) return { html, text: text ?? htmlToText(html) }
  if (text !== undefined) return { html: `<p>${escapeHtml(text)}</p>`, text }
  return undefined
}

/** HTML and text of a post's first `content` value. */
export const postContent = (properties: Mf2Properties) => contentValue(properties.content?.[0])

const isNumber = (value: unknown): value is number => typeof value === 'number'

function photoView(value: Mf2Value): PhotoView | undefined {
  const url = mediaUrl(value)
  if (!url) return undefined
  if (!isObject(value)) return { url }
  const { alt, width, height, sizes } = value
  const sizeEntries = Object.entries(isObject(sizes) ? sizes : {}).flatMap(([name, size]) =>
    isObject(size) && typeof size.url === 'string' && isNumber(size.width) && isNumber(size.height)
      ? [[name, { url: size.url, width: size.width, height: size.height }] as const]
      : []
  )
  return {
    url,
    ...(typeof alt === 'string' && { alt }),
    ...(isNumber(width) && { width }),
    ...(isNumber(height) && { height }),
    ...(sizeEntries.length && { sizes: Object.fromEntries(sizeEntries) }),
  }
}

function mediaUrl(value: Mf2Value): string | undefined {
  if (typeof value === 'string') return value
  return isObject(value) && typeof value.value === 'string' ? value.value : undefined
}

const mediaUrls = (properties: Mf2Properties, key: string) =>
  (properties[key] ?? []).map(mediaUrl).filter((url) => url !== undefined)

/** Projects full mf2 (as returned by `posts.toMf2()` or `q=source`) onto a {@link PostView}. */
export function toPostView(item: Mf2Item): PostView {
  const { properties } = item
  const content = postContent(properties)
  const summary = firstString(properties, 'summary')
  const featured = firstString(properties, 'featured')
  const published = firstString(properties, 'published')
  const visibility = firstString(properties, 'visibility')
  let name = firstString(properties, 'name')
  if (name && content && name.trim().toLowerCase() === content.text.trim().toLowerCase()) {
    name = undefined
  }
  return {
    type: item.type[0] ?? 'h-entry',
    ...(name !== undefined && { name }),
    ...(summary !== undefined && { summary }),
    ...(content && { content }),
    published: new Date(published ?? 0),
    updated: new Date(firstString(properties, 'updated') ?? published ?? 0),
    status: firstString(properties, 'post-status') === 'draft' ? 'draft' : 'published',
    visibility: visibility === 'unlisted' || visibility === 'private' ? visibility : 'public',
    categories: (properties.category ?? []).filter((value) => typeof value === 'string'),
    photos: (properties.photo ?? []).map(photoView).filter((photo) => photo !== undefined),
    videos: mediaUrls(properties, 'video'),
    audio: mediaUrls(properties, 'audio'),
    ...(featured !== undefined && { featured }),
    inReplyTo: urlValues(properties, 'in-reply-to'),
    likeOf: urlValues(properties, 'like-of'),
    repostOf: urlValues(properties, 'repost-of'),
    bookmarkOf: urlValues(properties, 'bookmark-of'),
    syndication: urlValues(properties, 'syndication'),
    children: (item.children ?? []).filter((child) => typeof child === 'string'),
  }
}
