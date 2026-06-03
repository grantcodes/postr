import { get as getCollection } from '../db.mjs'
import generateSearch from '../generate-search.mjs'
import hasScope from './has-scope.mjs'
import type { Request, Response, NextFunction } from 'express'

/**
 * Express middlewear to handle micropub actions (update, delete, etc.)
 */
export default [
  (req: Request, res: Response, next: NextFunction): void => {
    const { action } = req.body.micropub
    switch (action) {
      case 'update':
        hasScope('update')(req, res, next)
        return
      case 'delete':
        hasScope('delete')(req, res, next)
        return
      case 'undelete':
        hasScope('create')(req, res, next)
        return
    }
    next()
  },
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const collection = await getCollection()
    const micropub = Object.assign({}, req.body.micropub)
    // Check if this is an action first.
    if (micropub.action && micropub.url) {
      try {
        const search = generateSearch(micropub.url, true)
        const doc = await collection.findOne(search).exec()

        if (doc === null) {
          res.status(404).json({
            error: 'invalid_request',
            error_description: 'The post with the requested URL was not found',
          })
          return
        }

        switch (micropub.action) {
          // Handle updates
          case 'update': {
            const originalPermalink = doc.getPermalink()
            // Straight up replace properties
            if (micropub.replace) {
              if (typeof micropub.replace === 'string') {
                res.status(400).json({
                  error: 'invalid_request',
                  error_description: 'Replace object incorrectly formed',
                })
                return
              }
              for (const key in micropub.replace) {
                if (Object.prototype.hasOwnProperty.call(micropub.replace, key)) {
                  const value = micropub.replace[key]
                  await doc.update({ $set: { [`properties.${key}`]: value } })
                }
              }
            }

            // Add new properties
            if (micropub.add) {
              if (typeof micropub.add === 'string') {
                res.status(400).json({
                  error: 'invalid_request',
                  error_description: 'Add object incorrectly formed',
                })
                return
              }
              for (const key in micropub.add) {
                if (Object.prototype.hasOwnProperty.call(micropub.add, key)) {
                  const newValue = micropub.add[key]

                  const existingValue = doc.get(`properties.${key}`)
                  if (!existingValue) {
                    await doc.update({
                      $set: { [`properties.${key}`]: newValue },
                    })
                  } else {
                    const updatedValue = [...existingValue]
                    for (const value of newValue) {
                      updatedValue.push(value)
                    }
                    await doc.update({
                      $set: { [`properties.${key}`]: updatedValue },
                    })
                  }
                }
              }
            }

            // Delete specific properties
            if (micropub.delete) {
              if (typeof micropub.delete === 'string') {
                res.status(400).json({
                  error: 'invalid_request',
                  error_description: 'Delete object incorrectly formed',
                })
                return
              }

              let properties = doc._data.properties
              if (Array.isArray(micropub.delete)) {
                // Delete properties
                for (const key of micropub.delete) {
                  delete properties[key]
                }
              } else {
                // Delete values
                for (const key in micropub.delete) {
                  if (Object.prototype.hasOwnProperty.call(micropub.delete, key)) {
                    const valuesToDelete = micropub.delete[key]

                    if (Array.isArray(valuesToDelete)) {
                      let values = properties[key]
                      if (valuesToDelete && values) {
                        for (const value of valuesToDelete) {
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
                        }
                      }
                    } else {
                      // Looks like the delete request is malformed. Each property should be an array
                      res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'Delete object incorrectly formed',
                      })
                      return
                    }
                  }
                }
              }
              await doc.update({ $set: { properties } })
            }

            const newPermalink = doc.getPermalink()

            if (originalPermalink !== newPermalink) {
              res.status(201)
            }

            break
          }
          // Handle post deletes
          case 'delete': {
            await doc.update({
              $set: { 'properties.post-status': ['deleted'] },
            })
            break
          }
          // Handle post undeletes
          case 'undelete': {
            await doc.update({
              $set: { 'properties.post-status': ['published'] },
            })
            break
          }
          // Looks like there was an action but it isn't yet supported
          default: {
            res.status(501).json({
              error: 'invalid_request',
              error_description: micropub.action + ' action not supported',
            })
            return
          }
        }

        // Document successfully udpated
        res.header('Location', doc.getPermalink())
        res.json({ location: doc.getPermalink() })
        return
      } catch (err) {
        console.error('[Error performing micropub action]', err)
        res.status(500).json({
          error: 'internal_server_error',
          error_description: 'Error performing micropub action',
        })
        return
      }
    } else {
      next()
    }
  },
]
