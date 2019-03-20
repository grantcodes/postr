const fs = require('fs-extra')
const fetch = require('node-fetch')
const config = require('../config')

module.exports = async function(file) {
  const doc = this
  const mf2 = doc.toMf2()
  const fileProperties = ['photo', 'featured', 'video', 'audio']
  if (typeof file === 'object' && file.value) {
    file = file.value
  }
  for (const property of fileProperties) {
    if (mf2.properties[property]) {
      for (let fileUrl of mf2.properties[property]) {
        if (typeof fileUrl === 'object' && fileUrl.value) {
          fileUrl = fileUrl.value
        }
        if (fileUrl === file) {
          try {
            if (
              config.get('mediaDir') &&
              fileUrl.startsWith(config.get('mediaBaseUrl'))
            ) {
              // File is local, read it from the filesystem
              const fileLoc = fileUrl.replace(
                config.get('mediaBaseUrl'),
                config.get('mediaDir')
              )
              const buffer = fs.readFileSync(fileLoc)
              return buffer
            } else {
              // File is remote, read it from the url
              const res = await fetch(fileUrl, { method: 'get' })
              const buffer = await res.buffer()
              return buffer
            }
          } catch (err) {
            console.log('Error getting file buffer', err)
          }
          return null
        }
      }
    }
  }
}
