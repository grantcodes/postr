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
          if (
            config.get('mediaDir') &&
            typeof photo == 'string' &&
            (photo.indexOf('{{mediaBaseUrl}}') === 0 ||
              photo.indexOf(config.get('mediaBaseUrl')) === 0)
          ) {
            // Ok this photo is stored here, so check if it has resized versions
            if (isNode) {
              const fs = require('fs-extra')
              const photoFileLoc =
                config.get('mediaDir') +
                photo
                  .replace('{{mediaBaseUrl}}', '')
                  .replace(config.get('mediaBaseUrl'), '')
              let photoObject = {}
              for (const size in sizes) {
                if (fs.existsSync(appendToFilename(size, photoFileLoc))) {
                  photoObject[size] = appendToFilename(size, photo)
                } else {
                  photoObject[size] = photo
                }
              }
              result[photo] = photoObject
            } else {
              // Not node, so cant check that files exist, so just return a url for all sizes
              let photoObject = {}
              for (const size in sizes) {
                photoObject[size] = appendToFilename(size, photo)
              }
              result[photo] = photoObject
            }
          }
        })
      }
    })
  }
  return result
}
