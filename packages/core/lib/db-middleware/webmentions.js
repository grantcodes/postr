const { isRxDocument } = require('rxdb')
const sendWebmention = require('send-webmention')
const { getPermalink, getUrlsFromMf2 } = globalThis.__postr

/**
 * Will send any webmentions for a given RxDoc or mf2 object.
 * Should be run in parallel as it does not actually update the document
 * @param {isRxDocument|object} doc An RxDocument
 */
module.exports = doc => {
  let post = doc
  if (isRxDocument(doc)) {
    post = doc._data
  }
  const permalink = getPermalink(post)
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length && permalink) {
    // Got the urls to send webmentions to
    urls.forEach(url => {
      sendWebmention(permalink, url, (err, res) => {
        if (err) {
          console.error('Error sending webmention:', err)
        } else {
          // Webmention sent successfully
          console.log(
            `Webmention sent to ${url} was ${
              res && res.success ? 'accepted' : 'not accepted'
            }`
          )
        }
      })
    })
  }
  return doc
}
