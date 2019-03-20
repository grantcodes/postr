const fs = require('fs-extra')
const fetch = require('node-fetch')
const FormData = require('form-data')
const fileType = require('file-type')
const sizeOf = require('image-size')
const config = require('./config')
const todayMediaPath = require('./today-media-path')
const appendToFilename = require('./append-to-filename')

module.exports = async (buffer, filename) => {
  // Make sure there is a filename
  if (!filename) {
    filename = 'file'
  }

  // Add file extension if missing
  if (!filename.includes('.')) {
    filename += '.' + fileType(buffer).ext
  }

  // Replace spaces
  filename = filename.replace(' ', '-')

  // Send to media endpoint if there is one set
  if (config.get('mediaEndpoint')) {
    let token = config.get('rawToken')
    if (!token) {
      return reject('Missing token to save file to media endpoint')
    }
    // Save to media endpoint
    const form = new FormData()
    form.append('file', buffer, {
      filename,
      contentType: fileType(buffer).mime,
    })
    let request = {
      method: 'POST',
      body: form,
      headers: Object.assign(
        {
          Authorization: 'Bearer ' + token,
          Accept: '*/*',
        },
        form.getHeaders()
      ),
    }

    const res = fetch(config.get('mediaEndpoint'), request)
    if (res.status !== 201) {
      throw 'Error creating media on micropub endpoint'
    }
    const location = res.headers.get('Location') || res.headers.get('location')
    if (location) {
      return location
    } else {
      throw 'Media endpoint did not return a location'
    }
  } else {
    // Save locally
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
    fs.writeFileSync(fileLoc, buffer)
    const url = '{{mediaBaseUrl}}' + '/' + dateFolder + '/' + filename

    if (
      config.get('imageSizes') &&
      fileType(buffer).mime.startsWith('image/')
    ) {
      const sharp = require('sharp')
      const imageSizes = config.get('imageSizes')
      const sharpImage = sharp(buffer)
      const imageSize = sizeOf(buffer)
      for (const size in imageSizes) {
        const dimensions = imageSizes[size]

        if (imageSize && imageSize.width && imageSize.height) {
          if (
            imageSize.width > dimensions[0] ||
            imageSize.height > dimensions[1]
          ) {
            const resizedFileLoc = appendToFilename(size, fileLoc)
            sharpImage
              .resize(dimensions[0], dimensions[1] || null, {
                fit: sharp.fit.cover,
                position: sharp.strategy.entropy,
              })
              .toFile(resizedFileLoc)
          }
        }
      }
    }

    return url
  }
}
