const { isRxDocument } = require('rxdb')
const getUrlsFromMf2 = require('../get-urls-from-mf2')
const getHEntry = require('../get-hentry')
const config = require('../config')
const siteBaseUrl = config.get('siteBaseUrl')

// This will only work with an rxdoc, should be run in parallel
module.exports = async doc => {
  // TODO: Make this run for plain objects
  if (!isRxDocument(doc)) {
    console.log('Not creating refs because it is not a rxdoc')
    return doc
  }
  let post = doc._data
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length) {
    // Got the urls to scrape
    for (const url of urls) {
      if (url.indexOf(siteBaseUrl) === 0) {
        // This is a url to a page on your site, lets not scrape it
      } else {
        const res = await getHEntry(url)
        if (res) {
          if (!post.refs) {
            doc.set('_refs', [])
          }
          // TODO: Provide a method to get refs as an object
          // TODO: Provide a method to get the mf2 document from the document
          doc.set('_refs', [...doc.get('_refs'), res])
        }
      }
    }
  }
  return doc
}
