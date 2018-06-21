const { isRxDocument } = require('rxdb')
const sendWebmention = require('send-webmention')
const getUrlsFromMf2 = require('../get-urls-from-mf2')

// This will only work with an rxdoc, should be run in parallel
module.exports = doc => {
  // TODO: Make this run for plain objects
  if (!isRxDocument(doc)) {
    return doc
  }
  let post = doc._data
  const permalink = doc.getPermalink()
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length && permalink) {
    // Got the urls to send webmentions to
    urls.forEach(url => {
      sendWebmention(permalink, url, (err, res) => {
        if (err) {
          console.log('Error sending webmention:', err)
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
