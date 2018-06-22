const fs = require('fs-extra')
const fileType = require('file-type')
const sharp = require('sharp')
const sizeOf = require('image-size')
const config = require('./config')
const todayMediaPath = require('./today-media-path')

// TODO: Allow the user to supply an existing media endpoint.
// If that is given then this function should save media there and return the response url
// It may be difficult / annoying to pass the token along to that request

const appendToFilename = (extra, filename) => {
  const lastDot = filename.lastIndexOf('.')
  filename =
    filename.substring(0, lastDot) + '-' + extra + filename.substring(lastDot)
  return filename
}

module.exports = (buffer, filename) =>
  new Promise((resolve, reject) => {
    filename = filename.replace(' ', '-')
    const dateFolder = todayMediaPath()
    const folder = config.get('mediaDir') + '/' + dateFolder
    let fileLoc = `${folder}/${filename}`
    // Create the folder
    fs.mkdirsSync(folder)
    // Check file doesn't already exist
    let fileIndex = 0
    while (fs.existsSync(fileLoc)) {
      fileIndex++
      fileLoc = folder + '/' + appendToFilename(fileIndex, filename)
    }
    if (fileIndex > 0) {
      filename = appendToFilename(fileIndex, filename)
    }
    // Save file
    fs.writeFile(fileLoc, buffer, err => {
      if (err) {
        console.log('Error saving file', err)
        return reject(err)
      }
      const url = config.get('mediaBaseUrl') + '/' + dateFolder + '/' + filename

      if (fileType(buffer).mime.indexOf('image/') === 0) {
        const imageSizes = config.get('imageSizes')
        const sharpImage = sharp(buffer)
        const imageSize = sizeOf(buffer)
        for (const size in imageSizes) {
          const dimensions = imageSizes[size]

          if (imageSize && imageSize.width && imageSize.height) {
            // Save decent size but not huge
            if (
              imageSize.width > dimensions[0] ||
              imageSize.height > dimensions[1]
            ) {
              sharpImage.resize(dimensions[0], dimensions[1] || null)
              const resizedFileLoc = appendToFilename(size, fileLoc)
              sharpImage.crop(sharp.strategy.entropy).toFile(resizedFileLoc)
            }
          }
        }
      }

      return resolve(url)
    })
  })
