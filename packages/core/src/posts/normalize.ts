import slugify from '@sindresorhus/slugify'
import { PostrError } from '../errors.ts'
import { firstString, type Mf2Item, type Mf2Properties, type Mf2Value } from '../mf2.ts'
import { formatContent } from './content.ts'
import { generateSlug } from './permalink.ts'
import { discoverPostType, type PostTypeDefinition } from './post-type.ts'

export const statuses = ['published', 'draft'] as const
export const visibilities = ['public', 'unlisted', 'private'] as const

export type PostStatus = (typeof statuses)[number]
export type PostVisibility = (typeof visibilities)[number]

export interface NormalizedPost {
  type: string
  postType: string
  slug: string
  status: PostStatus
  visibility: PostVisibility
  published: string
  publishedAt: number
  updated: string
  properties: Mf2Properties
  children: string[] | null
}

export interface NormalizeOptions {
  siteUrl: string
  formatContent: boolean
  postTypes: PostTypeDefinition[]
  now: Date
  /** Slug to keep when the input has no `mp-slug`. */
  slug?: string
}

/** Properties that live in their own columns rather than in `properties`. */
const columnProperties = ['published', 'updated', 'post-status', 'visibility']

function parseDate(value: string, name: string): number {
  const time = Date.parse(value)
  if (Number.isNaN(time)) {
    throw new PostrError('invalid_request', `Invalid ${name} date: ${value}`)
  }
  return time
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
  fallback: T,
  name: string
): T {
  if (value === undefined) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new PostrError('invalid_request', `Invalid ${name}: ${value}`)
}

/**
 * Splits an mf2 item into stored columns and content properties, applying defaults.
 * Returns the Micropub `mp-*` commands separately because they are never stored.
 */
export function normalizePost(item: Mf2Item, options: NormalizeOptions) {
  const commands: Mf2Properties = {}
  let properties: Mf2Properties = {}
  for (const [key, values] of Object.entries(item.properties)) {
    if (key.startsWith('mp-')) commands[key] = values
    else if (key !== 'access_token' && values.length) properties[key] = values
  }

  if (options.formatContent) properties = formatContent(properties)

  if (properties.photo) {
    properties.photo = properties.photo.map((photo): Mf2Value =>
      typeof photo === 'string' ? { value: photo } : photo
    )
  }

  // The permalink is derived from `path`; only external canonical URLs are kept.
  if (properties.url) {
    const external = properties.url.filter(
      (url) => typeof url !== 'string' || !url.startsWith(options.siteUrl)
    )
    if (external.length) properties.url = external
    else delete properties.url
  }

  const nowIso = options.now.toISOString()
  const published = firstString(properties, 'published') ?? nowIso
  const updated = firstString(properties, 'updated') ?? nowIso
  const publishedAt = parseDate(published, 'published')
  parseDate(updated, 'updated')

  let visibility = firstString(properties, 'visibility')
  if (visibility === 'visible') visibility = 'public'

  const status = oneOf(statuses, firstString(properties, 'post-status'), 'published', 'post-status')
  const children = item.children?.filter((child) => typeof child === 'string') ?? null

  for (const key of columnProperties) delete properties[key]

  const requestedSlug = firstString(commands, 'mp-slug')
  const slug = requestedSlug
    ? slugify(requestedSlug)
    : (options.slug ?? generateSlug(properties, options.now))
  if (!slug) throw new PostrError('invalid_request', 'Invalid mp-slug')

  const type = item.type[0] ?? 'h-entry'
  const post: NormalizedPost = {
    type,
    postType: discoverPostType(
      { type: [type], properties, children: children ?? undefined },
      options.postTypes
    ),
    slug,
    status,
    visibility: oneOf(visibilities, visibility, 'public', 'visibility'),
    published,
    publishedAt,
    updated,
    properties,
    children: children?.length ? children : null,
  }
  return { post, commands }
}
