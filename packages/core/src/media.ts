import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'

export interface MediaFile {
  data: Uint8Array
  name?: string
  type?: string
}

export interface MediaStore {
  /** Persists a file and returns its public URL. */
  save(file: MediaFile): Promise<string>
  /** Public URL prefix of saved files, so posts that already use them are not downloaded again. */
  url?: string
}

export interface LocalMediaOptions {
  /** Directory files are written to, in `yyyy/mm/dd` subfolders. */
  dir: string
  /** Public URL that serves `dir`. */
  url: string
  /** Resized copies written next to images as `name-<size>.ext`; needs the optional `sharp` peer. */
  imageSizes?: Record<string, [width: number, height?: number]>
}

/** `name-extra.ext` */
function appendToFilename(filename: string, extra: string | number) {
  const ext = extname(filename)
  return `${filename.slice(0, filename.length - ext.length)}-${extra}${ext}`
}

async function writeImageSizes(
  data: Uint8Array,
  path: string,
  sizes: NonNullable<LocalMediaOptions['imageSizes']>
) {
  const { default: sharp } = await import('sharp')
  const { width, height } = await sharp(data).metadata()
  for (const [size, [maxWidth, maxHeight]] of Object.entries(sizes)) {
    if (width <= maxWidth && (!maxHeight || height <= maxHeight)) continue
    await sharp(data)
      .resize(maxWidth, maxHeight ?? null, {
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy,
      })
      .toFile(appendToFilename(path, size))
  }
}

export function localMediaStore(options: LocalMediaOptions): MediaStore {
  const baseUrl = options.url.replace(/\/$/, '')
  return {
    url: baseUrl,
    async save(file) {
      let filename = basename(file.name || 'file')
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '')
        .replace(/^\.+/, '')
      const detected = await fileTypeFromBuffer(file.data)
      if (!extname(filename) && detected) filename += `.${detected.ext}`
      if (!filename || filename.startsWith('.')) filename = `file${filename}`

      const now = new Date()
      const folder = [
        now.getUTCFullYear(),
        String(now.getUTCMonth() + 1).padStart(2, '0'),
        String(now.getUTCDate()).padStart(2, '0'),
      ].join('/')
      await mkdir(join(options.dir, folder), { recursive: true })

      let name = filename
      for (let i = 1; ; i++) {
        try {
          await writeFile(join(options.dir, folder, name), file.data, { flag: 'wx' })
          break
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
          name = appendToFilename(filename, i)
        }
      }

      const mime = detected?.mime ?? file.type ?? ''
      if (options.imageSizes && mime.startsWith('image/') && mime !== 'image/svg+xml') {
        await writeImageSizes(file.data, join(options.dir, folder, name), options.imageSizes)
      }
      return `${baseUrl}/${folder}/${name}`
    },
  }
}

export function isMediaStore(media: MediaStore | LocalMediaOptions): media is MediaStore {
  return 'save' in media
}
