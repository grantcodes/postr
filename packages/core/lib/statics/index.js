const isNode = require('../is-node')
const getPermalink = require('./get-permalink')
const getReferences = require('./get-references')
const toMf2 = require('./to-mf2')
const getImageSizes = require('./image-sizes')
const getChildren = require('./get-children')
let getFileBuffer = () => null
if (isNode) {
  getFileBuffer = require('./get-file-buffer')
}

module.exports = {
  getFileBuffer,
  getPermalink,
  getReferences,
  getImageSizes,
  toMf2,
  getChildren,
}
