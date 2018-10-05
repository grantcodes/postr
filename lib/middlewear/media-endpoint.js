const saveFile = require('../save-file')
const hasScope = require('../has-scope')
const placeholders = require('../placeholders')

/**
 * Micropub media endpoint as an express middlewear
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next function
 */
module.exports = (req, res, next) => {
  if (!hasScope('create')) {
    res.status(401)
    return res.json({
      error: 'Insuficient scope',
      error_description:
        'The current token does not contain the post or create scopes',
    })
  }

  if (!req.file || req.file.truncated || !req.file.buffer) {
    res.status(400)
    return res.json({
      error: 'Error with file',
      error_description: 'Error or missing file',
    })
  }

  const filename = req.file.originalname
  // Save file
  saveFile(req.file.buffer, filename)
    .then(url => {
      url = placeholders.replace(url)
      res.status(201)
      res.header('Location', url)
      return res.json({
        location: url,
      })
    })
    .catch(err => {
      console.log('Error writing media endpoint file', err)
      res.status(500)
      return res.json({
        error: 'Error saving file',
        error_description: 'There was an error writing the media file to disk',
      })
    })
}
