import { urlValues, type Mf2Input, type Mf2Item, type Mf2Properties } from './mf2.ts'
import type { Postr } from './postr.ts'

/** A post document from a postr 1.x `collection.dump()`. */
export interface LegacyDoc {
  _id?: string
  type: string[]
  properties: Mf2Properties
  children?: string[]
  /** 1.x metadata; `references` holds the fetched h-entries of the URLs the post responds to. */
  cms?: { references?: Mf2Item[] }
}

export interface LegacyImportOptions {
  /** 1.x `siteBaseUrl`, substituted for `{{siteBaseUrl}}` placeholders. */
  siteBaseUrl: string
  /** 1.x `mediaBaseUrl`, substituted for `{{mediaBaseUrl}}` placeholders. */
  mediaBaseUrl?: string
  /** 1.x `permalinkPattern`, used to keep every existing permalink. Default `:siteBaseUrl/:year/:month/:day/:slug`. */
  permalinkPattern?: string
  /** 1.x `createdDateInPermalinks`: permalink dates use `created` when a post has it. */
  createdDateInPermalinks?: boolean
}

export interface LegacyImportReport {
  imported: number
  deleted: number
  /** Deleted posts left out because a live post already has their permalink. */
  skipped: Array<{ id?: string; path: string }>
  failed: Array<{ id?: string; error: string }>
}

function replacePlaceholders<T>(value: T, replacements: Record<string, string>): T {
  if (typeof value === 'string') {
    let result: string = value
    for (const [key, replacement] of Object.entries(replacements)) {
      result = result.replaceAll(`{{${key}}}`, replacement)
    }
    return result as T
  }
  if (Array.isArray(value)) return value.map((v) => replacePlaceholders(v, replacements)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replacePlaceholders(v, replacements)])
    ) as T
  }
  return value
}

/**
 * The path 1.x served a post at: its stored own URL, or the permalink computed the way 1.x
 * did (in the local timezone).
 */
function legacyPath(properties: Mf2Properties, options: LegacyImportOptions): string | undefined {
  const siteBaseUrl = options.siteBaseUrl.replace(/\/$/, '')
  const url = properties.url?.[0]
  if (typeof url === 'string' && url.startsWith(`${siteBaseUrl}/`)) {
    return url.slice(siteBaseUrl.length).replace(/[?#].*$/, '')
  }
  const slug = properties['mp-slug']?.[0]
  const created = options.createdDateInPermalinks ? properties.created?.[0] : undefined
  const dateString = typeof created === 'string' ? created : properties.published?.[0]
  if (typeof slug !== 'string' || typeof dateString !== 'string') return undefined
  const date = new Date(dateString)
  const permalink = (options.permalinkPattern ?? ':siteBaseUrl/:year/:month/:day/:slug')
    .replace(':siteBaseUrl', siteBaseUrl)
    .replace(':year', String(date.getFullYear()))
    .replace(':month', String(date.getMonth() + 1).padStart(2, '0'))
    .replace(':day', String(date.getDate()).padStart(2, '0'))
    .replace(':slug', slug)
  return permalink.startsWith(siteBaseUrl) ? permalink.slice(siteBaseUrl.length) : undefined
}

/** Drops `null` values and the Micropub commands 1.x kept, except `mp-slug`. */
function cleanProperties(properties: Mf2Properties): Mf2Properties {
  const cleaned: Mf2Properties = {}
  for (const [key, values] of Object.entries(properties)) {
    if (key.startsWith('mp-') && key !== 'mp-slug') continue
    const kept = values.filter((value) => value !== null && value !== undefined)
    if (kept.length) cleaned[key] = kept
  }
  return cleaned
}

/**
 * Imports posts from a postr 1.x dump, keeping ids, permalinks, dates and received mentions.
 * Imports use the `import` origin, so no webmentions or syndication are sent.
 */
export async function importLegacyPosts(
  postr: Postr,
  docs: LegacyDoc[],
  options: LegacyImportOptions
): Promise<LegacyImportReport> {
  const replacements: Record<string, string> = {
    siteBaseUrl: options.siteBaseUrl.replace(/\/$/, ''),
  }
  if (options.mediaBaseUrl) replacements.mediaBaseUrl = options.mediaBaseUrl.replace(/\/$/, '')
  const report: LegacyImportReport = { imported: 0, deleted: 0, skipped: [], failed: [] }

  const isDeleted = (doc: LegacyDoc) => doc.properties['post-status']?.[0] === 'deleted'
  // Live posts first, so a deleted duplicate never takes a live post's permalink.
  const ordered = [...docs.filter((doc) => !isDeleted(doc)), ...docs.filter(isDeleted)]

  for (const doc of ordered) {
    let path: string | undefined
    try {
      const properties = cleanProperties(replacePlaceholders(doc.properties, replacements))
      const deleted = isDeleted(doc)
      if (deleted) properties['post-status'] = ['published']
      // 1.x showed a post without `updated` as last changed when it was published.
      if (!properties.updated && properties.published) properties.updated = properties.published
      path = legacyPath(properties, options)
      if (deleted && path && (await postr.posts.getByUrl(postr.siteUrl + path))) {
        report.skipped.push({ id: doc._id, path })
        continue
      }
      const input: Mf2Input = { type: doc.type, properties }
      if (doc.children) input.children = replacePlaceholders(doc.children, replacements)

      await postr.posts.create(input, {
        origin: 'import',
        id: doc._id,
        path,
        deletedAt: deleted ? new Date().toISOString() : undefined,
      })
      for (const reference of doc.cms?.references ?? []) {
        const entry = replacePlaceholders(reference, replacements)
        if (!entry?.properties) continue
        for (const url of urlValues(entry.properties, 'url')) {
          await postr.posts.saveReference(url, entry)
        }
      }
      report.imported++
      if (deleted) report.deleted++
    } catch (err) {
      report.failed.push({ id: doc._id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return report
}
