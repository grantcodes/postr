import type { Mf2Input, Mf2Properties } from './mf2.ts'
import type { Postr } from './postr.ts'

/** A post document from a postr 1.x `collection.dump()`. */
export interface LegacyDoc {
  _id?: string
  type: string[]
  properties: Mf2Properties
  children?: string[]
}

export interface LegacyImportOptions {
  /** 1.x `siteBaseUrl`, substituted for `{{siteBaseUrl}}` placeholders. */
  siteBaseUrl: string
  /** 1.x `mediaBaseUrl`, substituted for `{{mediaBaseUrl}}` placeholders. */
  mediaBaseUrl?: string
  /** 1.x `permalinkPattern`, used to keep every existing permalink. Default `:siteBaseUrl/:year/:month/:day/:slug`. */
  permalinkPattern?: string
}

export interface LegacyImportReport {
  imported: number
  deleted: number
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

/** The path 1.x served a post at, computed the way 1.x did (in the local timezone). */
function legacyPath(doc: LegacyDoc, options: LegacyImportOptions): string | undefined {
  const slug = doc.properties['mp-slug']?.[0]
  const published = doc.properties.published?.[0]
  if (typeof slug !== 'string' || typeof published !== 'string') return undefined
  const date = new Date(published)
  const siteBaseUrl = options.siteBaseUrl.replace(/\/$/, '')
  const permalink = (options.permalinkPattern ?? ':siteBaseUrl/:year/:month/:day/:slug')
    .replace(':siteBaseUrl', siteBaseUrl)
    .replace(':year', String(date.getFullYear()))
    .replace(':month', String(date.getMonth() + 1).padStart(2, '0'))
    .replace(':day', String(date.getDate()).padStart(2, '0'))
    .replace(':slug', slug)
  return permalink.startsWith(siteBaseUrl) ? permalink.slice(siteBaseUrl.length) : undefined
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
  const report: LegacyImportReport = { imported: 0, deleted: 0, failed: [] }

  for (const doc of docs) {
    try {
      const properties = replacePlaceholders(doc.properties, replacements)
      const deleted = properties['post-status']?.[0] === 'deleted'
      if (deleted) properties['post-status'] = ['published']
      const input: Mf2Input = { type: doc.type, properties }
      if (doc.children) input.children = replacePlaceholders(doc.children, replacements)

      await postr.posts.create(input, {
        origin: 'import',
        id: doc._id,
        path: legacyPath(doc, options),
        deletedAt: deleted ? new Date().toISOString() : undefined,
      })
      report.imported++
      if (deleted) report.deleted++
    } catch (err) {
      report.failed.push({ id: doc._id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return report
}
