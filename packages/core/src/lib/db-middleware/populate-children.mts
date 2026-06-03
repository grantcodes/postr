import { isRxDocument } from 'rxdb'
import * as placeholders from '../placeholders.mjs'
import generateSearch from '../generate-search.mjs'

/**
 * Gets the post children ids and saves them to the database for faster retrieval
 */
export default (collection: any) => async (doc: any): Promise<any> => {
  const getChildIds = async (urls: string[]): Promise<string[]> => {
    const ids: string[] = []
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
