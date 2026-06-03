import getUrls from 'get-urls'
import isUrl from 'is-url'

export default function getUrlsFromMf2(post: any): string[] {
  const urls = new Set<string>()

  const urlProperties = ['like-of', 'bookmark-of', 'repost-of', 'in-reply-to']
  for (const key of urlProperties) {
    if (post.properties[key]) {
      const value = post.properties[key]
      if (Array.isArray(value)) {
        for (const subValue of value) {
          if (isUrl(subValue)) {
            urls.add(subValue)
          }
        }
      }
    }
  }

  if (post.properties.content) {
    for (let content of post.properties.content) {
      if (content.value) {
        content = content.value
      }
      const contentUrls = getUrls(content)
      if (contentUrls) {
        for (const url of contentUrls) {
          urls.add(url)
        }
      }
    }
  }

  return [...urls]
}
