import path from 'node:path'
import fs from 'node:fs'
import * as config from '../config.mjs'

export default async function getFileBuffer(this: any, file: any): Promise<Buffer | null> {
  const doc = this
  const mf2 = doc.toMf2()
  const fileProperties = ['photo', 'featured', 'video', 'audio']
  if (typeof file === 'object' && file.value) {
    file = file.value
  }
  for (const property of fileProperties) {
    if (mf2.properties[property]) {
      for (let fileUrl of mf2.properties[property]) {
        if (typeof fileUrl === 'object' && fileUrl.value) {
          fileUrl = fileUrl.value
        }
        if (fileUrl === file) {
          try {
            if (
              config.get('mediaDir') &&
              fileUrl.startsWith(config.get('mediaBaseUrl'))
            ) {
              const fileLoc = path.normalize(
                fileUrl.replace(
                  config.get('mediaBaseUrl'),
                  config.get('mediaDir'),
                ),
              )
              return fs.readFileSync(fileLoc)
            }
            const res = await fetch(fileUrl)
            return Buffer.from(await res.arrayBuffer())
          } catch (err) {
            console.log('Error getting file buffer', err)
          }
          return null
        }
      }
    }
  }
  return null
}
