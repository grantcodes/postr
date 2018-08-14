const fs = require('fs-extra')
const fetch = require('node-fetch')
const FormData = require('form-data')
const fileType = require('file-type')
const sharp = require('sharp')
const sizeOf = require('image-size')
const config = require('./config')
const todayMediaPath = require('./today-media-path')
const appendToFilename = require('./append-to-filename')

// TODO: Allow the user to supply an existing media endpoint.
// If that is given then this function should save media there and return the response url
// It may be difficult / annoying to pass the token along to that request

module.exports = (buffer, filename) =>
  new Promise((resolve, reject) => {
    // Make sure the filename is valid
    if (!filename) {
      filename = 'file'
    }
    if (filename.indexOf('.') === -1) {
      // No file extension!
      filename += '.' + fileType(buffer).ext
    }
    filename = filename.replace(' ', '-')
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

      fetch(config.get('mediaEndpoint'), request)
        .then(res => {
          if (res.status !== 201) {
            res.text().then(text => console.log('response text', text))
            return reject('Error creating media on micropub endpoint')
          }
          const location =
            res.headers.get('Location') || res.headers.get('location')
          if (location) {
            return resolve(location)
          } else {
            return reject('Media endpoint did not return a location')
          }
        })
        .catch(err => {
          console.log('Error with media endpoint post', err)
          return reject('Error sending request to media endpoint')
        })
    } else {
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
        const url =
          config.get('mediaBaseUrl') + '/' + dateFolder + '/' + filename

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
    }
  })
