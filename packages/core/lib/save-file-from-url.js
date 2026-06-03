const { basename } = require('path')
const { parse: parseUrl } = require('url')
const isUrl = require('is-url')
const saveFile = require('./save-file')

module.exports = async url => {
  if (!isUrl(url)) {
    throw 'Is not a url'
  }
  const response = await fetch(url, { method: 'get' })
  if (!response.ok) {
    throw 'Bad response'
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return saveFile(buffer, basename(parseUrl(url).pathname))
}
