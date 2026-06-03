import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import * as config from './config.mjs'
import todayMediaPath from './today-media-path.mjs'
import appendToFilename from './append-to-filename.mjs'

const require = createRequire(import.meta.url)
const fileType = require('file-type') as {
  (buffer: Buffer): { ext: string; mime: string } | null
  ext: string
  mime: string
  minimumBytes: number
}
const sizeOf = require('image-size') as {
  (input: Buffer | string): { width: number; height: number; type?: string }
}

export default async function saveFile(
  buffer: Buffer,
  filename?: string,
): Promise<string> {
  if (!filename) {
    filename = 'file'
  }

  // Add file extension if missing
  if (!filename.includes('.')) {
    const ft = fileType(buffer)
    if (ft) filename += '.' + ft.ext
  }

  filename = filename.replace(' ', '-')

  if (config.get('mediaEndpoint')) {
    const token = config.get('rawToken')
    if (!token) {
      throw new Error('Missing token to save file to media endpoint')
    }
    const ft = fileType(buffer)
    const mime = ft ? ft.mime : 'application/octet-stream'
    const form = new FormData()
    form.append('file', new Blob([buffer as BlobPart], { type: mime }), filename)

    const res = await fetch(config.get('mediaEndpoint'), {
      method: 'POST',
      body: form,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: '*/*',
      },
    })
    if (res.status !== 201) {
      throw new Error('Error creating media on micropub endpoint')
    }
    const location = res.headers.get('Location') || res.headers.get('location')
    if (location) return location
    throw new Error('Media endpoint did not return a location')
  }

  // Save locally
  const dateFolder = todayMediaPath()
  const folder = path.join(config.get('mediaDir'), dateFolder)
  let fileLoc = `${folder}/${filename}`
  fs.mkdirSync(folder, { recursive: true })
  let fileIndex = 0
  while (fs.existsSync(fileLoc)) {
    fileIndex++
    fileLoc = folder + '/' + appendToFilename(fileIndex, filename)
  }
  if (fileIndex > 0) {
    filename = appendToFilename(fileIndex, filename)
  }
  fs.writeFileSync(fileLoc, new Uint8Array(buffer))
  const url = '{{mediaBaseUrl}}' + '/' + dateFolder + '/' + filename

  const detectedType = fileType(buffer)
  if (
    config.get('imageSizes') &&
    detectedType &&
    detectedType.mime.startsWith('image/')
  ) {
    const sharp = require('sharp') as any
    const imageSizes = config.get('imageSizes')
    const sharpImage = sharp(buffer)
    const imageSize = sizeOf(buffer)
    for (const size in imageSizes) {
      const dimensions = imageSizes[size]
      if (imageSize && imageSize.width && imageSize.height) {
        if (
          imageSize.width > dimensions[0] ||
          imageSize.height > dimensions[1]
        ) {
          const resizedFileLoc = appendToFilename(size, fileLoc)
          sharpImage
            .resize(dimensions[0], dimensions[1] || null, {
              fit: sharp.fit.cover,
              position: sharp.strategy.entropy,
            })
            .toFile(resizedFileLoc)
        }
      }
    }
  }

  return url
}
