const config = require('../config')
const isNode = require('../is-node')
const appendToFilename = require('../append-to-filename')

function removeMediaBaseUrlFromUrl(photoUrl) {
  photoUrl = photoUrl
    .replace('{{mediaBaseUrl}}', '')
    .replace(config.get('mediaBaseUrl'), '')

  return photoUrl
}

module.exports = function () {
  const doc = this
  const post = doc._data
  let result = {}
  const sizes = config.get('imageSizes')
  if (sizes) {
    const imageProperties = ['photo', 'featured']
    imageProperties.forEach((key) => {
      if (post.properties[key]) {
        post.properties[key].forEach((photo) => {
          let photoUrl = photo
          if (
            photoUrl &&
            typeof photoUrl === 'object' &&
            photoUrl.value &&
            typeof photoUrl.value === 'string'
          ) {
            photoUrl = photoUrl.value
          }
          if (
            config.get('mediaDir') &&
            typeof photoUrl == 'string' &&
            (photoUrl.indexOf('{{mediaBaseUrl}}') === 0 ||
              photoUrl.indexOf(config.get('mediaBaseUrl')) === 0)
          ) {
            // Ok this photo is stored here, so check if it has resized versions
            if (isNode) {
              const path = require('path')
              const fs = require('fs-extra')
              const imageSize = require('image-size')
              const photoFileLoc = path.join(
                config.get('mediaDir'),
                removeMediaBaseUrlFromUrl(photoUrl)
              )
              let photoObject = imageSize(photoFileLoc)
              for (const size in sizes) {
                const resizedPhotoUrl = appendToFilename(size, photoUrl)
                const resizedPhotoFileLoc = appendToFilename(size, photoFileLoc)
                if (fs.existsSync(resizedPhotoFileLoc)) {
                  const imageDetails = imageSize(resizedPhotoFileLoc)
                  photoObject[size] = {
                    url: resizedPhotoUrl,
                    ...imageDetails,
                  }
                } else {
                  photoObject[size] = photoUrl
                }
              }
              result[photoUrl] = photoObject
            } else {
              // Not node, so cant check that files exist, so just return a url for all sizes
              let photoObject = {}
              for (const size in sizes) {
                photoObject[size] = appendToFilename(size, photoUrl)
              }
              result[photoUrl] = photoObject
            }
          }
        })
      }
    })
  }
  return result
}
