import { isRxDocument } from 'rxdb'
import getUrlsFromMf2 from '../get-urls-from-mf2.mjs'
import getHEntry from '../get-hentry.mjs'
import { get } from '../config.mjs'

const siteBaseUrl = get('siteBaseUrl') as string

// This will only work with an rxdoc, should be run in parallel to prevent it slowing down other databse stuff

/**
 * Scrapes urls from a RxDocument and saves the mf2 data in a _refs array
 */
export default async (post: any): Promise<any> => {
  if (isRxDocument(post)) {
    // Don't update rx docs
    return post
  }
  const urls = getUrlsFromMf2(post)
  if (urls && urls.length) {
    // Got the urls to scrape
    for (const url of urls) {
      if (!url.startsWith(siteBaseUrl)) {
        // This is not a url to a page on your site, so lets scrape it
        try {
          const res = await getHEntry(url)
          if (res) {
            // NOTE: I store this as an array rather than the references object specified by jf2 as dots in property names cause too many issues
            if (!post.cms) {
              post.cms = { references: [] }
            }
            if (!post.cms.references) {
              post.cms.references = []
            }
            post.cms.references.push(res)
          }
        } catch (err) {
          // Error getting h-entry from url. Probably not a big deal
          console.warn(`[Error getting h-entry from ${url}]`, err)
        }
      }
    }
  }
  return post
}
