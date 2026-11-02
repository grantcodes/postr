import { parseHTML } from 'linkedom'
import { urlValues, type Mf2Properties } from '../mf2.ts'

/** Properties whose values are URLs of other posts this post responds to. */
export const responseProperties = [
  'in-reply-to',
  'like-of',
  'repost-of',
  'bookmark-of',
  'quotation-of',
  'listen-of',
  'read-of',
  'watch-of',
]

export interface PostLink {
  rel: string
  url: string
}

/** External URLs a post links to: response properties plus links in `content.html`. */
export function getLinks(properties: Mf2Properties, siteUrl: string): PostLink[] {
  const links = new Map<string, PostLink>()
  const add = (rel: string, url: string) => {
    if (!url.startsWith(siteUrl) && /^https?:/.test(url)) {
      links.set(`${rel} ${url}`, { rel, url })
    }
  }
  for (const rel of responseProperties) {
    for (const url of urlValues(properties, rel)) add(rel, url)
  }
  for (const content of properties.content ?? []) {
    if (content && typeof content === 'object' && typeof content.html === 'string') {
      const { document } = parseHTML(`<html><body>${content.html}</body></html>`)
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href')
        if (href && URL.canParse(href)) add('mention', href)
      }
    }
  }
  return [...links.values()]
}
