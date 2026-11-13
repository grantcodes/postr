import { access } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { inArray, isNull } from 'drizzle-orm'
import { fileTypeFromFile } from 'file-type'
import type { Database } from './db/index.ts'
import { media, posts as postsTable, type ImageSize } from './db/schema.ts'
import {
  appendToFilename,
  isImageType,
  type LocalMediaOptions,
  type SavedMediaFile,
} from './media.ts'
import type { Mf2Value } from './mf2.ts'
import type { Logger } from './options.ts'
import type { PostService } from './posts/service.ts'

export interface BackfillResult {
  /** Distinct local photo URLs found in posts. */
  scanned: number
  /** Images whose dimensions were recorded. */
  recorded: number
  /** Missing or unreadable files. */
  skipped: number
  /** Posts re-saved with dimensions. */
  posts: number
}

type Sharp = (typeof import('sharp'))['default']

let sharpModule: Promise<Sharp | undefined> | undefined

/** The optional `sharp` peer, or `undefined` when it is not installed. */
function loadSharp() {
  sharpModule ??= import('sharp').then(
    (module) => module.default,
    (err: NodeJS.ErrnoException) => {
      if (err.code === 'ERR_MODULE_NOT_FOUND') return undefined
      throw err
    }
  )
  return sharpModule
}

/** Displayed dimensions: EXIF orientations 5–8 swap width and height. */
async function dimensions(sharp: Sharp, path: string) {
  const { width, height, orientation = 1 } = await sharp(path).metadata()
  return orientation >= 5 ? { width: height, height: width } : { width, height }
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  )

function photoUrl(value: Mf2Value): string | undefined {
  if (typeof value === 'string') return value
  return typeof value === 'object' && typeof value.value === 'string' ? value.value : undefined
}

interface MediaLibraryOptions {
  db: Database
  /** Set when postr writes media to a local directory. */
  local?: LocalMediaOptions
  log: Logger
  posts: () => PostService
}

/** Image dimensions of the local media store, recorded on save and added to photos. */
export function createMediaLibrary({ db, local, log, posts }: MediaLibraryOptions) {
  /** Records an image and its existing `imageSizes` copies; needs sharp. */
  async function record({ url, path, type }: SavedMediaFile): Promise<boolean> {
    if (!isImageType(type)) return false
    const sharp = await loadSharp()
    if (!sharp) return false
    try {
      const size = await dimensions(sharp, path)
      const sizes: Record<string, ImageSize> = {}
      for (const name of Object.keys(local?.imageSizes ?? {})) {
        const copy = appendToFilename(path, name)
        if (await exists(copy)) {
          sizes[name] = { url: appendToFilename(url, name), ...(await dimensions(sharp, copy)) }
        }
      }
      await db
        .insert(media)
        .values({ url, type, ...size, sizes, createdAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: media.url, set: { type, ...size, sizes } })
      return true
    } catch (err) {
      log.warn(`[postr] could not read image ${url}: ${(err as Error).message}`)
      return false
    }
  }

  /** Adds `width`, `height` and `sizes` to photos with recorded dimensions. */
  async function enrichPhotos(photos: Mf2Value[]): Promise<Mf2Value[]> {
    const urls = photos.map(photoUrl).filter((url) => url !== undefined)
    if (!urls.length) return photos
    const rows = await db.select().from(media).where(inArray(media.url, urls))
    if (!rows.length) return photos
    const byUrl = new Map(rows.map((row) => [row.url, row]))
    return photos.map((photo) => {
      const url = photoUrl(photo)
      const row = url === undefined ? undefined : byUrl.get(url)
      if (!row) return photo
      return {
        ...(typeof photo === 'object' ? photo : { value: url }),
        width: row.width,
        height: row.height,
        ...(Object.keys(row.sizes).length ? { sizes: row.sizes } : {}),
      }
    })
  }

  /** Path under `dir` of a local media URL, or `undefined` if it points elsewhere. */
  function localPath(url: string, base: string) {
    if (!local || !url.startsWith(base)) return undefined
    let path: string
    try {
      path = join(local.dir, decodeURIComponent(url.slice(base.length)))
    } catch {
      return undefined
    }
    const inside = relative(local.dir, path)
    return inside && !inside.startsWith('..') && !isAbsolute(inside) ? path : undefined
  }

  /**
   * Records existing local photos of every non-deleted post and re-saves posts that gain
   * dimensions, keeping their `updated` date. Run it after importing 1.x data.
   */
  async function backfill(): Promise<BackfillResult> {
    if (!local) throw new Error('postr: media.backfill() needs local media options ({ dir, url })')
    if (!(await loadSharp())) {
      throw new Error('postr: media.backfill() needs the optional "sharp" package installed')
    }
    const base = `${local.url.replace(/\/$/, '')}/`
    const result: BackfillResult = { scanned: 0, recorded: 0, skipped: 0, posts: 0 }
    const rows = await db
      .select({ id: postsTable.id, properties: postsTable.properties, updated: postsTable.updated })
      .from(postsTable)
      .where(isNull(postsTable.deletedAt))

    const seen = new Set<string>()
    for (const row of rows) {
      for (const url of (row.properties.photo ?? []).map(photoUrl)) {
        if (!url?.startsWith(base) || seen.has(url)) continue
        seen.add(url)
        result.scanned++
        const path = localPath(url, base)
        const type = path && (await exists(path)) ? (await fileTypeFromFile(path))?.mime : undefined
        if (path && type && (await record({ url, path, type }))) result.recorded++
        else result.skipped++
      }
    }

    for (const row of rows) {
      const photos = row.properties.photo
      if (!photos) continue
      const enriched = await enrichPhotos(photos)
      if (JSON.stringify(enriched) === JSON.stringify(photos)) continue
      await posts().update(
        row.id,
        { replace: { updated: [row.updated] } },
        { origin: 'postr:media-backfill' }
      )
      result.posts++
    }
    return result
  }

  return { record, enrichPhotos, backfill }
}

export type MediaLibrary = ReturnType<typeof createMediaLibrary>
