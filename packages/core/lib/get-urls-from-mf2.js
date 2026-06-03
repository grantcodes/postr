const getUrls = require('get-urls')
const isUrl = require('is-url')

module.exports = post => {
  const urls = new Set()

  // Get urls from the properties
  const urlProperties = ['like-of', 'bookmark-of', 'repost-of', 'in-reply-to']
  urlProperties.forEach(key => {
    if (post.properties[key]) {
      const value = post.properties[key]
      if (Array.isArray(value)) {
        value.forEach(subValue => {
          if (isUrl(subValue)) {
            urls.add(subValue)
          }
        })
      }
    }
  })

  // Find urls in content
  if (post.properties.content) {
    post.properties.content.forEach(content => {
      if (content.value) {
        content = content.value
      }
      const contentUrls = getUrls(content)
      if (contentUrls) {
        contentUrls.forEach(url => urls.add(url))
      }
    })
  }

  return [...urls]
}
