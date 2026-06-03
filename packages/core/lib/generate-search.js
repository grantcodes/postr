const pathToRegexp = require('path-to-regexp')
const config = require('./config')

/**
 *
 * @param {object|string} options If this is a string then it is assumed it is a url, otherwise if it is an object is is assumed to be a pouchdb selector
 * @param {boolean} showAll If set to true the search won't hide private, deleted or draft posts
 */
module.exports = (options, showAll = false) => {
  let search = {}
  if (!showAll) {
    search = {
      'properties.visibility.0': 'visible',
      'properties.post-status.0': 'published',
    }
  }
  if (typeof options === 'string') {
    // Generate the search from a url
    const pattern = config
      .get('permalinkPattern')
      .replace(':siteBaseUrl', config.get('siteBaseUrl'))

    if (!showAll) {
      search['properties.visibility.0'] = {
        $ne: 'private',
      }
    }

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
      if (part && part.name && result && result[i + 1]) {
        params[part.name] = result[i + 1]
      }
    })

    if (params.slug) {
      search['properties.mp-slug.0'] = params.slug
    }

    if (params.year && params.month && params.day) {
      const startDate = new Date(`${params.year}-${params.month}-${params.day}`)
      // Need to do this so that time zones dont mess stuff up
      startDate.setDate(startDate.getDate() - 1)
      const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)
      if (config.get('createdDateInPermalinks')) {
        search.$or = [
          {
            'properties.created.0': {
              $gte: startDate.toISOString(),
              $lt: endDate.toISOString(),
            },
          },
          {
            'properties.published.0': {
              $gte: startDate.toISOString(),
              $lt: endDate.toISOString(),
            },
          },
        ]
      } else {
        search['properties.published.0'] = {
          $gte: startDate.toISOString(),
          $lt: endDate.toISOString(),
        }
      }
    }
  } else {
    Object.assign(search, options)
  }
  return search
}
