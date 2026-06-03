import * as config from '../config.mjs'
import isNode from '../is-node.mjs'
import appendToFilename from '../append-to-filename.mjs'

function removeMediaBaseUrlFromUrl(photoUrl: string): string {
  return photoUrl
    .replace('{{mediaBaseUrl}}', '')
    .replace(config.get('mediaBaseUrl'), '')
}

function getImageDetails(photoUrl: string): any {
  const details: any = {
    url: photoUrl,
    type: null,
    width: null,
    height: null,
  }

  if (isNode) {
    const path = require('node:path')
    const fs = require('node:fs')
    const imageSize = require('image-size')

    const photoFileLoc = path.join(
      config.get('mediaDir'),
      removeMediaBaseUrlFromUrl(photoUrl),
    )

    if (fs.existsSync(photoFileLoc)) {
      Object.assign(details, imageSize(photoFileLoc))
    }
  }

  return details
}

export default function imageSizes(this: any): any {
  const doc = this
  const post = doc._data
  const result: any = {}
  const sizes = config.get('imageSizes')
  if (sizes) {
    const imageProperties = ['photo', 'featured']
    for (const key of imageProperties) {
      if (post.properties[key]) {
        for (const photo of post.properties[key]) {
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
            typeof photoUrl === 'string' &&
            (photoUrl.indexOf('{{mediaBaseUrl}}') === 0 ||
              photoUrl.indexOf(config.get('mediaBaseUrl')) === 0)
          ) {
            const photoObject = getImageDetails(photoUrl)
            for (const size in sizes) {
              photoObject[size] = getImageDetails(
                appendToFilename(size, photoUrl),
              )
            }
            result[photoUrl] = photoObject
          }
        }
      }
    }
  }
  return result
}
