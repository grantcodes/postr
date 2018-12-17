const { isRxDocument } = require('rxdb')
const placeholders = require('../placeholders')
const generateSearch = require('../generate-search')

/**
 * Gets the post children ids and saves them to the database for faster retrieval
 * @param {RxDocument|object} doc An RxDocument
 */
module.exports = collection => async doc => {
  const getChildIds = async urls => {
    let ids = []
    for (const url of urls) {
      const fullUrl = placeholders.replace(url)
      const search = generateSearch(fullUrl)
      const post = await collection.findOne(search).exec()
      if (post) {
        const id = post.get('_id')
        ids.push(id)
      }
    }
    return ids
  }

  if (isRxDocument(doc)) {
    const childUrls = doc.get('children')
    if (childUrls) {
      const childIds = await getChildIds(childUrls)
      doc.update({ $set: { 'cms.children': childIds } })
    }
  } else {
    const childUrls = doc.children
    if (childUrls) {
      const childIds = await getChildIds(childUrls)
      doc.cms.children = childIds
    }
  }

  return doc
}
