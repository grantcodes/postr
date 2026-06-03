import * as config from './config.mjs'

const keys = ['mediaBaseUrl', 'siteBaseUrl']

export function add(url: any): any {
  for (const key of keys) {
    if (url && typeof url === 'string') {
      url = url.replace(config.get(key), `{{${key}}}`)
    }
  }
  return url
}

export function replace(url: any): any {
  for (const key of keys) {
    if (url && typeof url === 'string') {
      url = url.replace(`{{${key}}}`, config.get(key))
    } else if (
      url &&
      typeof url === 'object' &&
      url.value &&
      typeof url.value === 'string'
    ) {
      url.value = url.value.replace(`{{${key}}}`, config.get(key))
    }
  }
  return url
}

export function replaceMf2(mf2: any): any {
  if (mf2.properties.url) {
    mf2.properties.url = mf2.properties.url.map(replace)
  }
  if (mf2.children) {
    mf2.children = mf2.children.map(replace)
  }
  if (mf2.properties.photo) {
    mf2.properties.photo = mf2.properties.photo.map(replace)
  }
  if (mf2.properties.video) {
    mf2.properties.video = mf2.properties.video.map(replace)
  }
  if (mf2.properties.audio) {
    mf2.properties.audio = mf2.properties.audio.map(replace)
  }
  if (mf2.cms?.imageSizes) {
    for (const imageUrl in mf2.cms.imageSizes) {
      const sizes: any = { ...mf2.cms.imageSizes[imageUrl] }
      for (const size in sizes) {
        sizes[size] = replace(sizes[size])
      }
      mf2.cms.imageSizes[replace(imageUrl)] = sizes
      if (imageUrl !== replace(imageUrl)) {
        delete mf2.cms.imageSizes[imageUrl]
      }
    }
  }
  return mf2
}
