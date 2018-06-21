const saveFile = require('../save-file')

module.exports = (req, res, next) => {
  console.log('Media endpoint', req.file)
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
