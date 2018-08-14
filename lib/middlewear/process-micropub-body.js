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
  if (req.is('json')) {
    micropub = req.body
  } else {
    // Generate the mf2 json from body parameters
    micropub = {
      type: [req.body.h ? 'h-' + req.body.h : 'h-entry'],
      properties: {},
    }

    delete req.body.h

    if (req.body.action) {
      // This is an action thing
      micropub = req.body
    } else {
      // This is probably a new post
      for (const key in req.body) {
        const value = req.body[key]
        if (Array.isArray(value)) {
          micropub.properties[key] = value
        } else {
          micropub.properties[key] = [value]
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

  req.body.micropub = micropub
  next()
}
