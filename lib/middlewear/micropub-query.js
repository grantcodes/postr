const Collection = require('../db')
const config = require('../config')
const generateSearch = require('../generate-search')

/**
 * Handle micropub queries via an express middlewear
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = async (req, res, next) => {
  const collection = await Collection.get()
  if (!req.query || !Object.keys(req.query).length) {
    // If a simple GET is performed, then we just want to verify the authorization credentials
    res.status(200)
    return res.json({})
  } else if (req.query.q) {
    // This is a query
    const query = req.query.q

    let syndicationServices = config.get('syndication')

    switch (query) {
      // Syndication providers
      case 'syndicate-to': {
        return res.json({ 'syndicate-to': syndicationServices })
        break
      }
      // Get config
      case 'config': {
        return res.json({
          'syndicate-to': syndicationServices,
          'media-endpoint': config.get('mediaEnpoint')
            ? config.get('mediaEnpoint')
            : config.get('endpointBaseUrl') + '/media',
          // TODO: Make supported post types configurable
          'post-types': [
            {
              type: 'note',
              name: 'Note',
            },
            {
              type: 'article',
              name: 'Post',
            },
            {
              type: 'photo',
              name: 'Photo',
            },
            {
              type: 'video',
              name: 'Video',
            },
            {
              type: 'reply',
              name: 'Reply',
            },
            {
              type: 'like',
              name: 'Like',
            },
            {
              type: 'repost',
              name: 'Repost',
            },
            {
              type: 'rsvp',
              name: 'RSVP',
            },
            {
              type: 'bookmark',
              name: 'Bookmark',
            },
            {
              type: 'collection',
              name: 'Collection',
            },
          ],
        })
        break
      }
      // Get the details of a micropub post
      case 'source': {
        if (req.query.url) {
          // TODO: This will still return private and deleted posts, which is probably not correct
          const search = generateSearch(req.query.url, true)
          collection
            .findOne(search)
            .exec()
            .then(doc => {
              if (doc === null) {
                res.status(404)
                return res.json({
                  error: 'invalid_request',
                  error_description: 'Error finding post',
                })
              }
              const post = doc.toMf2()
              let response = {}
              if (!req.query.properties) {
                // The request is for the entire mf2 document
                response = post
              } else {
                // The request is for specific properties. So only return those
                response.properties = {}
                req.query.properties.forEach(propertyName => {
                  response.properties[propertyName] =
                    post.properties[propertyName]
                })
              }
              return res.json(response)
            })
            .catch(err => {
              console.log('error finding post', err)
              res.status(404)
              return res.json({
                error: 'invalid_request',
                error_description: 'Error finding post',
              })
            })
        } else {
          // No url provided with source query, so should return a list of posts
          let search = {
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
            limit = parseInt(req.query.limit)
          }

          // Support pagination
          if (req.query.before || req.query.after) {
            offset = limit * parseInt(req.query.before || req.query.after)
          }

          // Support reverse order
          if (req.query.order && req.query.order == 'reverse') {
            reverse = true
          }

          // Support checking if property exist
          if (req.query.exists) {
            if (!Array.isArray(req.query.exists)) {
              req.query.exists = [req.query.exists]
            }
            req.query.exists.forEach(property => {
              search[`properties.${property}`] = { $exists: true }
            })
          }

          // Support checking if property does not exists
          if (req.query['not-exists']) {
            if (!Array.isArray(req.query['not-exists'])) {
              req.query['not-exists'] = [req.query['not-exists']]
            }
            req.query['not-exists'].forEach(property => {
              search[`properties.${property}`] = { $exists: false }
            })
          }

          // Support checking for property values
          for (const key in req.query) {
            if (
              req.query.hasOwnProperty(key) &&
              key.indexOf('property-') === 0
            ) {
              const property = key.substring('property-'.length)
              const value = req.query[key]
              search[`properties.${property}`] = { $in: [value] }
            }
          }

          collection
            .find(search)
            .limit(limit)
            .skip(offset)
            // .sort({ indexDate: reverse ? 'asc' : 'desc' })
            .exec()
            .then(docs => {
              if (!docs) {
                res.status(404)
                return res.json({
                  error: 'invalid_request',
                  error_description: 'Error finding post',
                })
              }
              let result = {
                items: docs.map(doc => doc.toMf2()),
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
              return res.json(result)
            })
            .catch(err => {
              console.log('error finding posts', err)
              res.status(404)
              return res.json({
                error: 'invalid_request',
                error_description: 'Error finding post',
              })
            })
        }
        break
      }
      // Not implemented
      default: {
        res.status(501)
        return res.json({
          error: 'invalid_request',
          error_description:
            'This endpoint does not support that query at the moment',
        })
      }
    }
  }
}
