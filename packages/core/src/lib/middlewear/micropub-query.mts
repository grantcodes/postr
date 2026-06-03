import { get as getCollection } from '../db.mjs'
import { get } from '../config.mjs'
import generateSearch from '../generate-search.mjs'
import { getAvailablePostTypes } from '../post-type-discovery.mjs'
import type { Request, Response, NextFunction } from 'express'

const getMicropubConfig = async () => {
  const defaultMicropubConfig = {
    'media-endpoint': get('mediaEndpoint')
      ? get('mediaEndpoint')
      : get('endpointBaseUrl') + '/media',
    'syndicate-to': get('syndication'),
    categories: await getCategories(),
    'post-types': getAvailablePostTypes(),
  }

  return Object.assign(
    defaultMicropubConfig,
    get('micropubConfig'),
  )
}

const getCategories = async () => {
  const collection = await getCollection()
  const cachedCategories = await collection.getLocal('postrCoreCategories')
  if (
    cachedCategories &&
    cachedCategories.categories &&
    cachedCategories.date > Date.now() - 1000 * 60 * 60 * 24
  ) {
    return cachedCategories.categories
  }
  const docs = await collection
    .find(
      {
        'properties.category': { $exists: true },
        'properties.post-status.0': 'published',
      },
      { 'properties.category': 1 },
    )
    .exec()
  const categorySet = new Set()
  for (const doc of docs) {
    for (const cat of doc.get('properties.category')) {
      if (cat) {
        categorySet.add(cat)
      }
    }
  }
  const categories = [...categorySet].sort()
  collection.upsertLocal('postrCoreCategories', {
    categories,
    date: Date.now(),
  })
  return categories
}

/**
 * Handle micropub queries via an express middlewear
 */
export default async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const collection = await getCollection()
  if (!req.query || !Object.keys(req.query).length) {
    // If a simple GET is performed, then we just want to verify the authorization credentials
    res.status(200)
    res.json({})
    return
  } else if (req.query.q) {
    // This is a query
    const query = req.query.q

    const micropubConfig = await getMicropubConfig()

    switch (query) {
      // Get config
      case 'config': {
        res.json(micropubConfig)
        return
      }

      // Categories for suggestions
      case 'category': {
        let categories = micropubConfig.categories
        if (req.query.search) {
          categories = categories.filter((cat: string) =>
            cat.toLowerCase().includes((req.query.search as string).trim().toLowerCase()),
          )
        }
        res.json({ categories })
        return
      }
      // Get the details of a micropub post
      case 'source': {
        if (req.query.url) {
          // TODO: This will still return private and deleted posts, which is probably not correct
          const search = generateSearch(req.query.url, true)
          collection
            .findOne(search)
            .exec()
            .then((doc: any) => {
              if (doc === null) {
                res.status(404)
                res.json({
                  error: 'invalid_request',
                  error_description: 'Error finding post',
                })
                return
              }
              const post = doc.toMf2()
              let response: any = {}
              if (!req.query.properties) {
                // The request is for the entire mf2 document
                response = post
              } else {
                // The request is for specific properties. So only return those
                response.properties = {}
                const props = Array.isArray(req.query.properties)
                  ? req.query.properties
                  : [req.query.properties]
                props.forEach((propertyName: string) => {
                  response.properties[propertyName] =
                    post.properties[propertyName]
                })
              }
              res.json(response)
            })
            .catch((err: Error) => {
              console.log('error finding post', err)
              res.status(404)
              res.json({
                error: 'invalid_request',
                error_description: 'Error finding post',
              })
            })
        } else {
          // No url provided with source query, so should return a list of posts
          let search: any = {
            'properties.post-status': { $nin: ['deleted'] },
          }
          let limit = 20
          let offset = 0
          let reverse = false

          // Query by post type
          if (req.query['post-type']) {
            search['cms.postType'] = req.query['post-type']
          }

          // Support limit
          if (req.query.limit) {
            limit = parseInt(req.query.limit as string)
          }

          // Support pagination
          if (req.query.before || req.query.after) {
            offset =
              limit *
              parseInt((req.query.before || req.query.after) as string)
          }

          // Support reverse order
          if (req.query.order && req.query.order == 'reverse') {
            reverse = true
          }

          // Support checking if property exist
          if (req.query.exists) {
            const exists = Array.isArray(req.query.exists)
              ? req.query.exists
              : [req.query.exists]
            exists.forEach((property: string) => {
              search[`properties.${property}`] = { $exists: true }
            })
          }

          // Support checking if property does not exists
          if (req.query['not-exists']) {
            const notExists = Array.isArray(req.query['not-exists'])
              ? req.query['not-exists']
              : [req.query['not-exists']]
            notExists.forEach((property: string) => {
              search[`properties.${property}`] = { $exists: false }
            })
          }

          // Support checking for property values
          for (const key in req.query) {
            if (
              Object.prototype.hasOwnProperty.call(req.query, key) &&
              key.indexOf('property-') === 0
            ) {
              const property = key.substring('property-'.length)
              const value = (req.query as any)[key]
              search[`properties.${property}`] = { $in: [value] }
            }
          }

          collection
            .find(search)
            .limit(limit)
            .skip(offset)
            .sort({ indexDate: reverse ? 'asc' : 'desc' })
            .exec()
            .then((docs: any) => {
              if (!docs) {
                res.status(404)
                res.json({
                  error: 'invalid_request',
                  error_description: 'Error finding post',
                })
                return
              }
              let result: any = {
                items: docs.map((doc: any) => doc.toMf2()),
              }
              if (docs.length === limit) {
                if (!offset) {
                  result.after = 1
                } else {
                  result.after = limit / offset + 1
                }
              }
              if (offset && limit / offset > 0) {
                result.before = limit / offset - 1
              }
              res.json(result)
            })
            .catch((err: Error) => {
              console.log('error finding posts', err)
              res.status(404)
              res.json({
                error: 'invalid_request',
                error_description: 'Error finding post',
              })
            })
        }
        break
      }
      default: {
        // Check if the query is a property in the config object.
        if (typeof query === 'string' && (micropubConfig as any)[query]) {
          res.json({ [query]: (micropubConfig as any)[query] })
          return
        }

        // Not implemented
        res.status(501).json({
          error: 'invalid_request',
          error_description:
            'This endpoint does not support that query at the moment',
        })
      }
    }
  }
}
