import { replaceMf2 } from '../placeholders.mjs'
import getPermalinkFromMf2 from '../get-permalink-from-mf2.mjs'

export default function toMf2(this: any): any {
  const doc = this
  let post: any = { ...doc._data }
  if (!post.cms) {
    post.cms = {}
  }
  post.references = doc.getReferences()
  post.cms.imageSizes = doc.getImageSizes()
  const { removedRefereces: _refs, ...cms } = post.cms
  post.cms = cms

  if (!post.properties.url) {
    post.properties.url = [getPermalinkFromMf2(post)]
  }

  post = replaceMf2(post)

  for (const key of Object.keys(post)) {
    if (key.startsWith('_') || key.startsWith('index')) {
      delete post[key]
    }
  }

  return post
}
