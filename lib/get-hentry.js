const fetch = require('node-fetch')
const moment = require('moment')
const Microformats = require('microformat-node')
// const mf2ExpandUrls = require('./mf2-expand-urls')
const MicropubError = require('./error')
const basename = require('path').basename
const saveFile = require('./save-file.js')
const Mercury = require('@postlight/mercury-parser')
const oembedProviders = require('oembed-providers')

const getEmbed = async url => {
  try {
    const urlHostname = new URL(url).hostname.replace('www.', '')
    const provider = oembedProviders.find(
      p => new URL(p.provider_url).hostname.replace('www.', '') === urlHostname
    )
    if (provider) {
      const providerEndpoint = provider.endpoints[0].url.replace(
        '{{format}}',
        'json'
      )
      const requestUrl = new URL(providerEndpoint)
      requestUrl.searchParams.append('url', url)
      const res = await fetch(requestUrl.href)
      let data = await res.json()

      if (!data.html && data.type === 'photo') {
        data.html = `<img src="${data.url}" width="${data.width}" height="${
          data.height
        }" />`
      }
      return data
    }
    // TODO: If no provider, perhaps should consider attempting discovery
  } catch (err) {
    console.warn('[Error getting oembed]', err)
  }
  return null
}

/**
 * Fetches the given url and either parses mf2 or creates it form other metadata
 */
async function getHEntry(url, storeFiles = true) {
  try {
    const response = await fetch(url, { type: 'get' })
    if (!response.ok) {
      throw new MicropubError({
        status: response.status,
        message: 'Bad response',
      })
    }
    const mimeType = response.headers.get('content-type')

    let mf2 = {
      type: ['h-entry'],
      properties: {
        url: [url],
      },
    }

    const bufferToFile = async (type, mime) => {
      if (saveFile && mimeType.indexOf(mime + '/') === 0) {
        if (storeFiles) {
          const buffer = await response.buffer()
          const fileUrl = await saveFile(
            buffer,
            basename(parseUrl(url).pathname)
          )
          if (fileUrl) {
            mf2.properties[type] = [fileUrl]
          } else {
            mf2.properties[type] = [url]
          }
        } else {
          mf2.properties[type] = [url]
        }
      }
    }

    // Handle media files followed by html handling
    await bufferToFile('audio', 'audio')
    await bufferToFile('photo', 'image')
    await bufferToFile('video', 'video')
    if (mimeType.startsWith('text/')) {
      const html = await response.text()
      let meta = {}
      let embed = null
      if (Mercury && getEmbed) {
        meta = await Mercury.parse(url, { html })
        embed = await getEmbed(meta.url || url)
      }

      // Create a base mf2 object from the metadata
      mf2 = {
        type: ['h-entry'],
        properties: {
          url: [url],
        },
      }

      if (meta.title) {
        mf2.properties.name = [meta.title]
      }
      if (meta.excerpt) {
        mf2.properties.summary = [meta.excerpt]
      }
      if (meta.lead_image_url) {
        mf2.properties.featured = [meta.lead_image_url]
      }
      if (meta.content) {
        mf2.properties.content = [
          {
            html: meta.content,
          },
        ]
      }
      if (meta.author) {
        mf2.properties.author = [
          {
            type: ['h-card'],
            properties: {
              url,
              name: meta.author,
            },
          },
        ]
      }

      for (const key in mf2.properties) {
        if (mf2.properties.hasOwnProperty(key)) {
          const value = mf2.properties[key]
          if (!value.length || value[0] == '' || value[0] == null) {
            delete mf2.properties[key]
          }
        }
      }

      if (meta.date_published) {
        const published = moment(meta.date_published)
        if (published.isValid()) {
          mf2.properties.published = [published.toISOString()]
        }
      }

      // Use embed data if there is any
      if (embed) {
        if (embed.title) {
          mf2.properties.name = [embed.title]
        }
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

      // Parse actual mf2
      const { items } = await Microformats.getAsync({
        html: html,
        filters: ['h-entry'],
      })
      if (items && items.length === 1) {
        const item = items[0]
        if (Object.keys(item.properties).length > 1) {
          mf2 = item
          // TODO: Maybe should grab author from a h-card elsewhere on the page
          // TODO: Expand urls to make sure they are not relative links
          // mf2 = mf2ExpandUrls(mf2, url)
          // TODO: Check all urls and make sure they are not relative
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
    if (err instanceof MicropubError) {
      throw err
    } else {
      console.error('[Error generating mf2 for url]', err)
      throw new MicropubError({
        message: 'Server error occurred',
        error: err,
      })
    }
  }
}

module.exports = getHEntry
