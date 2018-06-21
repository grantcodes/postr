const { isRxDocument } = require('rxdb')
const saveFileFromUrl = require('../save-file-from-url')
const isUrl = require('is-url')
const config = require('../config')
const mediaBaseUrl = config.get('mediaBaseUrl')

/**
 * Saves media properties passed as urls to local files
 * @param {RxDocument} A RxDocument
 */
module.exports = async doc => {
  if (!isRxDocument(doc)) {
    return doc
  }
  // Save media urls to local files
  const mediaProperties = ['photo', 'audio', 'video']
  for (const mediaProperty of mediaProperties) {
    const mediaUrls = doc.get(`properties.${mediaProperty}`)
    if (mediaUrls) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaUrl = mediaUrls[i]
        if (isUrl(mediaUrl) && mediaUrl.indexOf(mediaBaseUrl) !== 0) {
          const localUrl = await saveFileFromUrl(mediaUrl)
          if (localUrl) {
            doc.set(`properties.${mediaProperty}.${i}`, localUrl)
          }
        }
      }
    }
  }
  return doc
}
