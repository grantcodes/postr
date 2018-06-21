const { parse: parseUrl } = require('url')
const config = require('./config')

module.exports = (options, showAll = false) => {
  let search = {}
  if (!showAll) {
    search = {
      'properties.visibility': {
        $nin: ['private'],
      },
      'properties.post-status': {
        $nin: ['deleted', 'draft'],
      },
    }
  }
  if (typeof options === 'string') {
    // Generate the search from a url
    const pattern = config.get('permalinkPattern')
    const siteBaseUrl = config.get('siteBaseUrl')
    const parsedPattern = parseUrl(
      pattern.replace('{{siteBaseUrl}}', siteBaseUrl)
    )
    const url = parseUrl(options)
    const patternPathParts = parsedPattern.pathname.split('/')
    const pathParts = url.pathname.split('/')
    let slug = null
    let day = null
    let month = null
    let year = null
    patternPathParts.forEach((variable, i) => {
      switch (decodeURIComponent(variable)) {
        case '{{slug}}':
          slug = pathParts[i]
          break
        case '{{year}}':
          year = pathParts[i]
          break
        case '{{month}}':
          month = pathParts[i]
          break
        case '{{day}}':
          day = pathParts[i]
          break
        default:
          break
      }
    })
    if (slug) {
      search['properties.mp-slug.0'] = slug
    }
    if (year && month && day) {
      const startDate = new Date(`${year}-${month}-${day}`)
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      search['properties.published.0'] = {
        $gte: startDate.toISOString(),
        $lt: endDate.toISOString(),
      }
    }
  } else {
    Object.assign(search, options)
  }
  console.log('search', search)
  return search
}
