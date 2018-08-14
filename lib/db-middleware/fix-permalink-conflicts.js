const { isRxDocument } = require('rxdb')
const getPermalink = require('../get-permalink-from-mf2')
const generateSearch = require('../generate-search')

/**
 * A function that returns a database middlewear function
 * The middleware checks for conficting permalinks and modifies the mp-slug until there are no conflicts
 * @param {RxCollection} collection The RXDB collection. This is needed to search for conflicts
 */
module.exports = collection => async doc => {
  let post = doc
  if (isRxDocument(post)) {
    post = post._data
  }
  const permalink = getPermalink(post)
  const search = generateSearch(permalink)
  const originalSlug = post.properties['mp-slug'][0]
  let permalinkConflictIndex = 0
  while (await collection.findOne(search).exec()) {
    // Uh oh looks like we have a permalink confict
    permalinkConflictIndex++
    const newSlug = originalSlug + '-' + permalinkConflictIndex
    search['properties.mp-slug.0'] = newSlug
  }
  if (permalinkConflictIndex > 0) {
    // Need to update to include this new index
    if (isRxDocument(doc)) {
      doc.set('properties.mp-slug', [
        originalSlug + '-' + permalinkConflictIndex,
      ])
    } else {
      doc.properties['mp-slug'] = [originalSlug + '-' + permalinkConflictIndex]
    }
  }
  return doc
}
