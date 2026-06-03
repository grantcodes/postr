import { createRequire } from 'node:module'
import { isRxDocument } from 'rxdb'
import getPermalinkFromMf2 from '../get-permalink-from-mf2.mjs'
import getUrlsFromMf2 from '../get-urls-from-mf2.mjs'

const require = createRequire(import.meta.url)
const sendWebmention: (...args: any[]) => void = require('send-webmention')

/**
 * Will send any webmentions for a given RxDoc or mf2 object.
 * Should be run in parallel as it does not actually update the document
 */
export default (doc: any): any => {
  let post = doc
  if (isRxDocument(doc)) {
    post = doc._data
  }
  const permalink = getPermalinkFromMf2(post)
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length && permalink) {
    // Got the urls to send webmentions to
    urls.forEach(url => {
      sendWebmention(permalink, url, (err: Error, res: any) => {
        if (err) {
          console.error('Error sending webmention:', err)
        } else {
          // Webmention sent successfully
          console.log(
            `Webmention sent to ${url} was ${
              res && res.success ? 'accepted' : 'not accepted'
            }`,
          )
        }
      })
    })
  }
  return doc
}
