const { parse: parseUrl } = require('url')
const pathToRegexp = require('path-to-regexp')
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
    const pattern = config
      .get('permalinkPattern')
      .replace(':siteBaseUrl', config.get('siteBaseUrl'))

    const params = {
      slug: null,
      day: null,
      month: null,
      year: null,
    }
    const foundKeys = []
    const re = pathToRegexp(pattern, foundKeys)
    const result = re.exec(options)

    foundKeys.forEach((part, i) => {
      if (part && part.name && result[i + 1]) {
        params[part.name] = result[i + 1]
      }
    })

    if (params.slug) {
      search['properties.mp-slug.0'] = params.slug
    }

    if (params.year && params.month && params.day) {
      const startDate = new Date(`${params.year}-${params.month}-${params.day}`)
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
