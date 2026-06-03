import { basename } from 'node:path'
import isUrl from 'is-url'
import saveFile from './save-file.mjs'

export default async function saveFileFromUrl(url: string): Promise<string> {
  if (!isUrl(url)) {
    throw new Error('Is not a url')
  }
  const response = await fetch(url, { method: 'get' })
  if (!response.ok) {
    throw new Error('Bad response')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const name = basename(new URL(url).pathname)
  return saveFile(buffer, name)
}
