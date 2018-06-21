const Collection = require('../db')
const config = require('../config')
const generateSearch = require('../generate-search')

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
              doc = doc.get()
              Object.keys(doc).forEach(key => {
                if (key.indexOf('_') === 0) {
                  delete doc[key]
                }
              })
              let response = {}
              if (!req.query.properties) {
                response = doc
              } else {
                response.properties = {}
                req.query.properties.forEach(propertyName => {
                  response.properties[propertyName] =
                    doc.properties[propertyName]
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
            // Add url to all documents
            docs = docs.map(doc => {
              let post = doc.get()
              if (!post.properties.url) {
                post.properties.url = [doc.getPermalink()]
              }
              // Delete cms specific stuff
              Object.keys(post).forEach(key => {
                if (key.indexOf('_') === 0) {
                  delete post[key]
                }
              })
              return post
            })
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
