const moment = require('moment')
const config = require('./config')

/**
 * Generates the permalink for a given post
 * @param {object} post A mf2 post json object
 */
module.exports = function(post) {
  const pattern = config.get('permalinkPattern')
  const useCreated = config.get('createdDateInPermalinks')

  let dateString = null
  if (useCreated && post.properties.created && post.properties.created[0]) {
    dateString = post.properties.created[0]
  } else if (
    post &&
    post.properties.published &&
    post.properties.published[0]
  ) {
    dateString = post.properties.published[0]
  }

  const date = moment(dateString || Date.now())
  const year = date.format('YYYY')
  const month = date.format('MM')
  const day = date.format('DD')
  const slug = post.properties['mp-slug'][0]

  return pattern
    .replace(':siteBaseUrl', config.get('siteBaseUrl'))
    .replace(':year', year)
    .replace(':month', month)
    .replace(':day', day)
    .replace(':slug', slug)
}
