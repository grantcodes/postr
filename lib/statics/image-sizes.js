const config = require('../config')
const isNode = require('../is-node')
const appendToFilename = require('../append-to-filename')

function removeMediaBaseUrlFromUrl(photoUrl) {
  photoUrl = photoUrl
    .replace('{{mediaBaseUrl}}', '')
    .replace(config.get('mediaBaseUrl'), '')

  return photoUrl
}

function getImageDetails(photoUrl) {
  let details = {
    url: photoUrl,
    type: null,
    width: null,
    height: null,
  }

  if (isNode) {
    const path = require('path')
    const fs = require('fs-extra')
    const imageSize = require('image-size')

    const photoFileLoc = path.join(
      config.get('mediaDir'),
      removeMediaBaseUrlFromUrl(photoUrl)
    )

    if (fs.existsSync(photoFileLoc)) {
      const imageSizes = imageSize(photoFileLoc)
      details = { ...details, ...imageSizes }
    }
  }

  return details
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
            let photoObject = getImageDetails(photoUrl)
            for (const size in sizes) {
              const resizedPhotoUrl = appendToFilename(size, photoUrl)
              photoObject[size] = getImageDetails(resizedPhotoUrl)
            }
            result[photoUrl] = photoObject
          }
        })
      }
    })
  }
  return result
}
