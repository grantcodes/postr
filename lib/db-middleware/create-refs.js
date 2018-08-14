const { isRxDocument } = require('rxdb')
const getUrlsFromMf2 = require('../get-urls-from-mf2')
const getHEntry = require('../get-hentry')
const config = require('../config')
const siteBaseUrl = config.get('siteBaseUrl')

// This will only work with an rxdoc, should be run in parallel to prevent it slowing down other databse stuff

/**
 * Scrapes urls from a RxDocument and saves the mf2 data in a _refs array
 * @param {RxDocument} doc The document to add references to
 */
module.exports = async doc => {
  if (!isRxDocument(doc) || !doc) {
    console.log('Not creating refs because it is not a rxdoc')
    return doc
  }
  let post = doc._data
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length) {
    // Got the urls to scrape
    for (const url of urls) {
      if (url.indexOf(siteBaseUrl) !== 0) {
        // This is not a url to a page on your site, so lets scrape it
        const res = await getHEntry(url)
        if (res) {
          // NOTE: I store this as an array rather than the references object specified by jf2 as dots in property names cause too many issues
          if (!post._refs) {
            doc.set('_refs', [])
          }
          doc.set('_refs', [...doc.get('_refs'), res])
        }
      }
    }
  }
  return doc
}
