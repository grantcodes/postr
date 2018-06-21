const { basename } = require('path')
const { parse: parseUrl } = require('url')
const fetch = require('node-fetch')
const isUrl = require('is-url')
const saveFile = require('./save-file')

module.exports = url =>
  new Promise((resolve, reject) => {
    if (!isUrl(url)) {
      return reject('Is not a url')
    }
    fetch(url, { method: 'get' })
      .then(response => {
        if (!response.ok) {
          return reject('Bad response')
        }
        return response.buffer()
      })
      .then(buffer => {
        return saveFile(buffer, basename(parseUrl(url).pathname))
      })
      .then(fileUrl => resolve(fileUrl))
      .catch(err => reject(err))
  })
