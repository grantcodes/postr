const { isRxDocument } = require('rxdb')
const saveFileFromUrl = require('../save-file-from-url')
const isUrl = require('is-url')
const config = require('../config')
const mediaBaseUrl = config.get('mediaBaseUrl')

/**
 * Downloads and saves media properties passed as urls to local files,
 * replacing the property urls with the local file url
 * @param {RxDocument|object} A RxDocument or mf2 post json
 */
module.exports = async doc => {
  let post = doc
  if (isRxDocument(post)) {
    post = doc._data
  }
  // Save media urls to local files
  const mediaProperties = ['photo', 'audio', 'video']
  for (const mediaProperty of mediaProperties) {
    const mediaUrls = post.properties[mediaProperty]
    if (mediaUrls) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaUrl = mediaUrls[i]
        if (isUrl(mediaUrl) && mediaUrl.indexOf(mediaBaseUrl) !== 0) {
          const localUrl = await saveFileFromUrl(mediaUrl)
          if (localUrl && isRxDocument(doc)) {
            doc.set(`properties.${mediaProperty}.${i}`, localUrl)
          } else if (localUrl) {
            post.properties[mediaProperty][i] = localUrl
          }
        } else if (
          mediaUrl &&
          typeof mediaUrl === 'object' &&
          isUrl(mediaBaseUrl.value)
        ) {
          // Probably is a photo with alt text.
          const localUrl = await saveFileFromUrl(mediaUrl.value)
          if (localUrl && isRxDocument(doc)) {
            doc.set(`properties.${mediaProperty}.${i}.value`, localUrl)
          } else if (localUrl) {
            post.properties[mediaProperty][i]['value'] = localUrl
          }
        }
      }
    }
  }
  if (isRxDocument(doc)) {
    return doc
  } else {
    return post
  }
}
