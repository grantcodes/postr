import { urlValues, type Mf2Input, type Mf2Item, type Mf2Properties } from './mf2.ts'
import type { Postr } from './postr.ts'

/** A post document from a postr 1.x `collection.dump()`. */
export interface LegacyDoc {
  _id?: string
  type: string[]
  properties: Mf2Properties
  children?: string[]
  /**
   * 1.x metadata; `references` holds the fetched h-entries of the URLs the post responds to,
   * `children` the 1.x ids of a collection's posts.
   */
  cms?: { references?: Mf2Item[]; children?: string[] }
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
  /** Deleted posts left out because another post already has their permalink. */
  skipped: Array<{ id?: string; path: string }>
  failed: Array<{ id?: string; error: string }>
  /**
   * Collection children (1.x ids) without an imported post: dropped from the collection, or still
   * linked when the child failed to import after it.
   */
  missingChildren: Array<{ id?: string; child: string }>
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

const isDeleted = (doc: LegacyDoc) => doc.properties['post-status']?.[0] === 'deleted'

/** A 1.x post's cleaned properties and the path it is imported at. */
function legacyPost(
  doc: LegacyDoc,
  replacements: Record<string, string>,
  options: LegacyImportOptions
) {
  const properties = cleanProperties(replacePlaceholders(doc.properties, replacements))
  const deleted = isDeleted(doc)
  if (deleted) properties['post-status'] = ['published']
  // 1.x showed a post without `updated` as last changed when it was published.
  if (!properties.updated && properties.published) properties.updated = properties.published
  return { properties, deleted, path: legacyPath(properties, options) }
}

/**
 * The path each 1.x id will be imported at, so a collection can link children imported after it.
 * The first post with a path keeps it; later ones are skipped or fail.
 */
function planPaths(
  ordered: LegacyDoc[],
  replacements: Record<string, string>,
  options: LegacyImportOptions
) {
  const planned = new Map<string, string>()
  const claimed = new Set<string>()
  for (const doc of ordered) {
    let path: string | undefined
    try {
      path = legacyPost(doc, replacements, options).path
    } catch {
      continue
    }
    if (!path || claimed.has(path)) continue
    claimed.add(path)
    if (doc._id) planned.set(doc._id, path)
  }
  return planned
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
  const report: LegacyImportReport = {
    imported: 0,
    deleted: 0,
    skipped: [],
    failed: [],
    missingChildren: [],
  }

  // Live posts first, so a deleted duplicate never takes a live post's permalink.
  const ordered = [...docs.filter((doc) => !isDeleted(doc)), ...docs.filter(isDeleted)]

  const plannedPaths = planPaths(ordered, replacements, options)
  const childLinks: Array<{ id?: string; child: string; path?: string }> = []

  for (const doc of ordered) {
    try {
      const { properties, deleted, path } = legacyPost(doc, replacements, options)
      if (
        deleted &&
        path &&
        (await postr.posts.getByUrl(postr.siteUrl + path, { includeDeleted: true }))
      ) {
        report.skipped.push({ id: doc._id, path })
        continue
      }
      const input: Mf2Input = { type: doc.type, properties }
      // 1.x linked children by id; the URLs in `doc.children` can carry a different date.
      const links = []
      for (const child of doc.cms?.children ?? []) {
        const childPath = (await postr.posts.get(child))?.path ?? plannedPaths.get(child)
        links.push({ id: doc._id, child, path: childPath })
      }
      if (doc.cms?.children) {
        input.children = links.flatMap(({ path }) => (path ? [postr.siteUrl + path] : []))
      } else if (doc.children) {
        input.children = replacePlaceholders(doc.children, replacements)
      }

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
      childLinks.push(...links)
      report.imported++
      if (deleted) report.deleted++
    } catch (err) {
      report.failed.push({ id: doc._id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  for (const { id, child, path } of childLinks) {
    if (!path || (await postr.posts.get(child))?.path !== path) {
      report.missingChildren.push({ id, child })
    }
  }
  return report
}
