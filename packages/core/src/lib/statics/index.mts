import isNode from '../is-node.mjs'
import getPermalinkFn from './get-permalink.mjs'
import getReferencesFn from './get-references.mjs'
import toMf2Fn from './to-mf2.mjs'
import getImageSizesFn from './image-sizes.mjs'
import getChildrenFn from './get-children.mjs'

let getFileBufferFn: any = () => null
if (isNode) {
  // Dynamic import for get-file-buffer since it depends on fs
  const mod = await import('./get-file-buffer.mjs')
  getFileBufferFn = mod.default
}

export const getFileBuffer = getFileBufferFn
export const getPermalink = getPermalinkFn
export const getReferences = getReferencesFn
export const getImageSizes = getImageSizesFn
export const toMf2 = toMf2Fn
export const getChildren = getChildrenFn
