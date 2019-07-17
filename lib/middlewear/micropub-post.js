const Collection = require('../db')
const hasScope = require('./has-scope')

/**
 * Handle creating micropub posts via an express middlewear
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = [
  hasScope('create'),
  async (req, res, next) => {
    if (
      req.body.micropub &&
      req.body.micropub.properties &&
      req.body.micropub.type
    ) {
      let micropub = req.body.micropub
      const collection = await Collection.get()
      collection
        .insert(micropub)
        .then(doc => {
          // Successfully added to the database
          res.status(201)
          res.header('Location', doc.getPermalink())
          return res.json({ location: doc.getPermalink(), item: doc.toMf2() })
        })
        .catch(err => {
          console.error('[Error creating new post]', err)
          return res.status(500).json({
            error: 'internal_server_error',
            error_description: 'Error creating post',
          })
        })
    } else {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing micropub post data',
      })
    }
  },
]
