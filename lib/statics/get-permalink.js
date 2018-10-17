const { isRxDocument } = require('rxdb')
const getPermalink = require('../get-permalink-from-mf2')

module.exports = function() {
  let post = this
  if (isRxDocument(post)) {
    post = post.toMf2()
  }
  return getPermalink(post)
}
