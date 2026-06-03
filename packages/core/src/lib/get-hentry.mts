import { createRequire } from 'node:module'
import { basename } from 'node:path'
import Microformats from 'microformat-node'
import MicropubError from './error.mjs'
import saveFile from './save-file.mjs'
import Mercury from '@postlight/mercury-parser'

const require = createRequire(import.meta.url)
const oembedProviders: any[] = require('oembed-providers')

const getEmbed = async (url: string): Promise<any> => {
  try {
    const urlHostname = new URL(url).hostname.replace('www.', '')
    const provider = oembedProviders.find(
      (p: any) =>
        new URL(p.provider_url).hostname.replace('www.', '') === urlHostname,
    )
    if (provider) {
      const providerEndpoint = provider.endpoints[0].url.replace(
        '{{format}}',
        'json',
      )
      const requestUrl = new URL(providerEndpoint)
      requestUrl.searchParams.append('url', url)
      const res = await fetch(requestUrl.href)
      const data = await res.json()

      if (!data.html && data.type === 'photo') {
        data.html = `<img src="${data.url}" width="${data.width}" height="${data.height}" />`
      }
      return data
    }
  } catch (err) {
    console.warn('[Error getting oembed]', err)
  }
  return null
}

export default async function getHEntry(
  url: string,
  storeFiles: boolean = true,
): Promise<any> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new MicropubError({
        status: response.status,
        message: 'Bad response',
      })
    }
    const mimeType = response.headers.get('content-type')

    let mf2: any = {
      type: ['h-entry'],
      properties: { url: [url] },
    }

    const bufferToFile = async (type: string, mime: string) => {
      if (mimeType && mimeType.startsWith(mime + '/')) {
        if (storeFiles) {
          const buffer = Buffer.from(await response.arrayBuffer())
          const fileUrl = await saveFile(buffer, basename(new URL(url).pathname))
          mf2.properties[type] = fileUrl ? [fileUrl] : [url]
        } else {
          mf2.properties[type] = [url]
        }
      }
    }

    await bufferToFile('audio', 'audio')
    await bufferToFile('photo', 'image')
    await bufferToFile('video', 'video')

    if (mimeType && mimeType.startsWith('text/')) {
      const html = await response.text()
      let meta: any = {}
      let embed: any = null

      if (Mercury) {
        meta = await Mercury.parse(url, { html })
        embed = await getEmbed(meta.url || url)
      }

      mf2 = {
        type: ['h-entry'],
        properties: { url: [url] },
      }

      if (meta.title) mf2.properties.name = [meta.title]
      if (meta.excerpt) mf2.properties.summary = [meta.excerpt]
      if (meta.lead_image_url) mf2.properties.featured = [meta.lead_image_url]
      if (meta.content) {
        mf2.properties.content = [{ html: meta.content }]
      }
      if (meta.author) {
        mf2.properties.author = [
          { type: ['h-card'], properties: { url, name: meta.author } },
        ]
      }

      for (const key in mf2.properties) {
        if (Object.prototype.hasOwnProperty.call(mf2.properties, key)) {
          const value = mf2.properties[key]
          if (!value.length || value[0] == '' || value[0] == null) {
            delete mf2.properties[key]
          }
        }
      }

      if (meta.date_published) {
        const published = new Date(meta.date_published)
        if (!isNaN(published.getTime())) {
          mf2.properties.published = [published.toISOString()]
        }
      }

      if (embed) {
        if (embed.title) mf2.properties.name = [embed.title]
        if (embed.author_name && mf2.properties.author) {
          mf2.properties.author[0].properties.name = [embed.author_name]
        }
        if (embed.author_url && mf2.properties.author) {
          mf2.properties.author[0].properties.name = [embed.author_url]
        }
        if (embed.html) {
          delete mf2.properties.featured
          mf2.properties.content = [{ html: embed.html }]
        }
        if (embed.thumbnail_url) {
          mf2.properties.featured = [embed.thumbnail_url]
        }
      }

      const { items } = await Microformats.getAsync({
        html,
        filters: ['h-entry'],
      })
      if (items && items.length === 1) {
        const item = items[0]
        if (Object.keys(item.properties).length > 1) {
          mf2 = item
        }
      }
    }

    if (Object.keys(mf2.properties).length === 0) {
      throw new MicropubError({
        status: response.status,
        message: 'No properties',
      })
    }

    return mf2
  } catch (err) {
    if (err instanceof MicropubError) throw err
    console.error('[Error generating mf2 for url]', err)
    throw new MicropubError({
      message: 'Server error occurred',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
