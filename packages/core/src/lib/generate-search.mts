import pathToRegexp from 'path-to-regexp'
import * as config from './config.mjs'

export default function generateSearch(
  options: any,
  showAll: boolean = false,
): any {
  let search: any = {}
  if (!showAll) {
    search = {
      'properties.visibility.0': 'visible',
      'properties.post-status.0': 'published',
    }
  }
  if (typeof options === 'string') {
    const pattern = config
      .get('permalinkPattern')
      .replace(':siteBaseUrl', config.get('siteBaseUrl'))

    if (!showAll) {
      search['properties.visibility.0'] = {
        $ne: 'private',
      }
    }

    const params: Record<string, string | null> = {
      slug: null,
      day: null,
      month: null,
      year: null,
    }
    const foundKeys: any[] = []
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
      const startDate = new Date(
        `${params.year}-${params.month}-${params.day}`,
      )
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
