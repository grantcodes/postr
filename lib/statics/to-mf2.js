const placeholders = require('../placeholders')
const getPermalink = require('../get-permalink-from-mf2')

module.exports = function () {
  const doc = this
  let post = Object.assign({}, doc._data)
  if (!post.cms) {
    post.cms = {}
  }
  post.references = doc.getReferences()
  post.cms.imageSizes = doc.getImageSizes()
  const { removedRefereces: references, ...cms } = post.cms
  post.cms = cms

  if (!post.properties.url) {
    post.properties.url = [getPermalink(post)]
  }

  post = placeholders.replaceMf2(post)

  // TODO: May want to do this in a more immutable friendly way
  Object.keys(post).forEach((key) => {
    if (key.indexOf('_') === 0) {
      delete post[key]
    }
    if (key.indexOf('index') === 0) {
      delete post[key]
    }
  })

  return post
}
