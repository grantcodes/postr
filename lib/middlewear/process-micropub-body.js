const clone = require('clone')
const saveFile = require('../save-file')

/**
 * Express middlewear to format a micropub request.
 * It converts form encoded requests to the json representation
 * and saves any files uploaded with the request
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = async (req, res, next) => {
  let micropub = null
  const body = req.body
  if (req.is('json')) {
    micropub = clone(body)
  } else {
    // Generate the mf2 json from body parameters
    micropub = {
      type: [body.h ? 'h-' + body.h : 'h-entry'],
      properties: {},
    }

    delete body.h

    if (body.action) {
      // This is an action thing
      micropub = body
    } else {
      // This is probably a new post
      for (const key in body) {
        const value = body[key]
        const propertyName = key.endsWith('[]') ? key.slice(0, -2) : key
        if (Array.isArray(value)) {
          micropub.properties[propertyName] = value
        } else {
          micropub.properties[propertyName] = [value]
        }
      }
    }
  }

  // Process uploaded media files
  if (req.files) {
    for (const key in req.files) {
      const files = req.files[key]
      const property = key.replace('[]', '')
      if (!Array.isArray(files)) {
        files = [files]
      }
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.originalname && file.buffer && !file.truncated) {
          try {
            const fileUrl = await saveFile(file.buffer, file.originalname)
            if (!micropub.properties) {
              micropub.properties = {}
            }
            if (!micropub.properties[property]) {
              micropub.properties[property] = []
            }
            micropub.properties[property].push(fileUrl)
          } catch (err) {
            console.log('Error saving file', err)
            res.status(500)
            return res.json({
              error: 'Error saving file',
              error_description: `Error saving ${property} file to disk`,
            })
          }
        }
      }
    }
  }

  // Delete access token
  if (micropub && micropub.properties && micropub.properties.access_token) {
    delete micropub.properties.access_token
  }

  req.body.micropub = micropub
  next()
}
