const path = require('path')
const fs = require('fs')
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
    const token = config.get('rawToken')
    if (!token) {
      throw new Error('Missing token to save file to media endpoint')
    }
    // Save to media endpoint using native FormData
    const mime = fileType(buffer).mime
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mime }), filename)

    const res = await fetch(config.get('mediaEndpoint'), {
      method: 'POST',
      body: form,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: '*/*',
      },
    })
    if (res.status !== 201) {
      throw new Error('Error creating media on micropub endpoint')
    }
    const location = res.headers.get('Location') || res.headers.get('location')
    if (location) {
      return location
    } else {
      throw new Error('Media endpoint did not return a location')
    }
  } else {
    // Save locally
    const dateFolder = todayMediaPath()
    const folder = path.join(config.get('mediaDir'), dateFolder)
    let fileLoc = `${folder}/${filename}`
    // TODO: Make this system extendible,
    // allow a function to accept the ideal file and folder name,
    // and return a url
    // But would also need to hook into the function that provides the resized image urls (image-sizes.js)
    // Create the folder
    fs.mkdirSync(folder, { recursive: true })
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

    const detectedType = fileType(buffer)
    if (
      config.get('imageSizes') &&
      detectedType &&
      detectedType.mime.startsWith('image/')
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
