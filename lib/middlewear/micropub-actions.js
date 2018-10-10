const Collection = require('../db')
const generateSearch = require('../generate-search')
const hasScope = require('../has-scope')

/**
 * Express middlewear to handle micropub actions (update, delete, etc.)
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = async (req, res, next) => {
  const collection = await Collection.get()
  const micropub = Object.assign({}, req.body.micropub)
  // Check if this is an action first.
  if (micropub.action && micropub.url) {
    const search = generateSearch(micropub.url, true)
    collection
      .findOne(search)
      .exec()
      .then(doc => {
        if (doc === null) {
          res.status(404)
          return res.json({
            error: 'Not Found',
            error_description: 'Could not find the given post',
          })
        }

        switch (micropub.action) {
          // Handle updates
          case 'update': {
            if (!hasScope('update')) {
              res.status(401)
              return res.json({
                error: 'Insuficient scope',
                error_description:
                  'The current token does not contain the post or create scopes',
              })
            }
            // Straight up replace properties
            if (micropub.replace) {
              if (typeof micropub.replace === 'string') {
                res.status(400)
                return res.json({
                  error_description: 'Replace object incorrectly formed',
                })
              }
              Object.keys(micropub.replace).forEach(key => {
                const value = micropub.replace[key]
                doc.update({ $set: { [`properties.${key}`]: value } })
              })
            }

            // Add new properties
            if (micropub.add) {
              if (typeof micropub.add === 'string') {
                res.status(400)
                return res.json({
                  error_description: 'Add object incorrectly formed',
                })
              }
              Object.keys(micropub.add).forEach(key => {
                const newValue = micropub.add[key]
                const existingValue = doc.get(`properties.${key}`)
                if (!existingValue) {
                  doc.update({ $set: { [`properties.${key}`]: newValue } })
                } else {
                  const updatedValue = [...existingValue]
                  newValue.forEach(value => {
                    updatedValue.push(value)
                  })
                  doc.update({ $set: { [`properties.${key}`]: updatedValue } })
                }
              })
            }

            // Delete specific properties
            if (micropub.delete) {
              if (typeof micropub.delete === 'string') {
                res.status(400)
                return res.json({
                  error_description: 'Delete object incorrectly formed',
                })
              }

              let properties = doc._data.properties
              if (Array.isArray(micropub.delete)) {
                // Delete properties
                micropub.delete.forEach(key => {
                  delete properties[key]
                })
              } else {
                // Delete values
                Object.keys(micropub.delete).forEach(key => {
                  const valuesToDelete = micropub.delete[key]
                  if (Array.isArray(valuesToDelete)) {
                    let values = properties[key]
                    if (valuesToDelete && values) {
                      valuesToDelete.forEach(value => {
                        const index = values.indexOf(value)
                        if (index > -1) {
                          values.splice(index, 1)
                        }
                        if (values.length < 1) {
                          // No values left so delete the property
                          delete properties[key]
                        } else {
                          properties[key] = values
                        }
                      })
                    }
                  } else {
                    // Looks like the delete request is malformed. Each property should be an array
                    // TODO: Probably want to throw error
                  }
                })
              }
              doc.update({ $set: { properties } })
            }
            break
          }
          // Handle post deletes
          case 'delete': {
            if (!hasScope('delete')) {
              res.status(401)
              return res.json({
                error: 'Insuficient scope',
                error_description:
                  'The current token does not contain the post or create scopes',
              })
            }
            doc.update({ $set: { 'properties.post-status': ['deleted'] } })
            break
          }
          // Handle post undeletes
          case 'undelete': {
            if (!hasScope('create')) {
              res.status(401)
              return res.json({
                error: 'Insuficient scope',
                error_description:
                  'The current token does not contain the post or create scopes',
              })
            }
            doc.update({ $set: { 'properties.post-status': ['published'] } })
            break
          }
          // Looks like there was an action but it isn't yet supported
          default: {
            res.status(501)
            res.json({
              error_description: micropub.action + ' action not supported',
            })
            break
          }
        }

        doc
          .save()
          .then(() => {
            // TODO: Send different headers if the permalink is different or is deleted
            // Document successfully udpated
            res.status(200)
            res.header('Location', doc.getPermalink())
            return res.json({ location: doc.getPermalink() })
          })
          .catch(err => {
            console.log('Error saving document after micropub update', err)
            res.status(500)
            return res.json({
              error: 'Error saving update',
              error_description: 'There was an error saving the update',
            })
          })
      })
      .catch(err => {
        console.log('Error getting post for action', err)
        res.status(500)
        return res.json({
          error_description: 'Error getting the post for the action',
        })
      })
  } else {
    next()
  }
}
