import { isRxDocument } from 'rxdb'
import getPermalinkFromMf2 from '../get-permalink-from-mf2.mjs'
import generateSearch from '../generate-search.mjs'

/**
 * A function that returns a database middlewear function
 * The middleware checks for conficting permalinks and modifies the mp-slug until there are no conflicts
 * @param collection The RXDB collection. This is needed to search for conflicts
 */
export default (collection: any) => async (doc: any): Promise<any> => {
  let post = doc
  if (isRxDocument(post)) {
    post = post._data
  }
  const permalink = getPermalinkFromMf2(post)
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
