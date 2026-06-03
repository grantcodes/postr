import { isRxDocument } from 'rxdb'
import isUrl from 'is-url'
import saveFileFromUrl from '../save-file-from-url.mjs'
import { get } from '../config.mjs'

const mediaBaseUrl = get('mediaBaseUrl') as string

/**
 * Downloads and saves media properties passed as urls to local files,
 * replacing the property urls with the local file url
 */
export default async (doc: any): Promise<any> => {
  let post = doc
  if (isRxDocument(post)) {
    post = doc._data
  }
  // Save media urls to local files
  const mediaProperties = ['photo', 'audio', 'video']
  for (const mediaProperty of mediaProperties) {
    const mediaUrls = post.properties[mediaProperty]
    if (mediaUrls) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaUrl = mediaUrls[i]
        if (isUrl(mediaUrl) && mediaUrl.indexOf(mediaBaseUrl) !== 0) {
          const localUrl = await saveFileFromUrl(mediaUrl)
          if (localUrl && isRxDocument(doc)) {
            doc.set(`properties.${mediaProperty}.${i}`, localUrl)
          } else if (localUrl) {
            post.properties[mediaProperty][i] = localUrl
          }
        } else if (
          mediaUrl &&
          typeof mediaUrl === 'object' &&
          isUrl(mediaUrl.value) &&
          mediaUrl.value.indexOf(mediaBaseUrl) !== 0
        ) {
          // Probably is a photo with alt text.
          const localUrl = await saveFileFromUrl(mediaUrl.value)
          if (localUrl && isRxDocument(doc)) {
            doc.set(`properties.${mediaProperty}.${i}.value`, localUrl)
          } else if (localUrl) {
            post.properties[mediaProperty][i]['value'] = localUrl
          }
        }
      }
    }
  }
  if (isRxDocument(doc)) {
    return doc
  } else {
    return post
  }
}
