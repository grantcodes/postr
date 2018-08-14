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
          'media-endpoint': config.get('endpoint') + '/media',
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
          res.status(400)
          return res.json({
            error: 'invalid_request',
            error_description: 'Missing query url',
          })
        }
        break
      }
      // This is specifically for this site, it is not an official thing.
      // Run a query like q=mongo&mongo={JSONQUERYHERE}&limit=10&start=10
      case 'mongo': {
        if (!req.query.mongo) {
          res.status(400)
          return res.json({
            error: 'invalid_request',
            error_description:
              'You need to include the mongo parameter with the query',
          })
        }

        const limit = parseInt(req.query.limit) || 10
        const start = parseInt(req.query.start) || 0
        let mongoSearch = {}
        try {
          mongoSearch = JSON.parse(req.query.mongo)
        } catch (err) {
          res.status(500)
          return res.json({
            error: 'invalid_request',
            error_description: 'Invalid json passed to mongo query',
          })
        }
        const search = generateSearch(mongoSearch)

        collection
          .find(search)
          .limit(limit)
          .skip(start)
          .exec()
          .then(docs => {
            docs = docs.map(doc => doc.toMf2())
            return res.json(docs)
          })

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
