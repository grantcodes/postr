const config = require('../config')
const isNode = require('../is-node')
const appendToFilename = require('../append-to-filename')

module.exports = function() {
  const doc = this
  const post = doc._data
  let result = {}
  const sizes = config.get('imageSizes')
  if (sizes) {
    const imageProperties = ['photo', 'featured']
    imageProperties.forEach(key => {
      if (post.properties[key]) {
        post.properties[key].forEach(photo => {
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
              const fs = require('fs-extra')
              const photoFileLoc =
                config.get('mediaDir') +
                photoUrl
                  .replace('{{mediaBaseUrl}}', '')
                  .replace(config.get('mediaBaseUrl'), '')
              let photoObject = {}
              for (const size in sizes) {
                if (fs.existsSync(appendToFilename(size, photoFileLoc))) {
                  photoObject[size] = appendToFilename(size, photoUrl)
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
