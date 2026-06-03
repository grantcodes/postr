import * as config from './config.mjs'

export default function getPermalinkFromMf2(post: any): string {
  const pattern = config.get('permalinkPattern')
  const useCreated = config.get('createdDateInPermalinks')

  let dateString: string | null = null
  if (useCreated && post.properties.created && post.properties.created[0]) {
    dateString = post.properties.created[0]
  } else if (
    post &&
    post.properties.published &&
    post.properties.published[0]
  ) {
    dateString = post.properties.published[0]
  }

  const date = new Date(dateString || Date.now())
  const year = date.getFullYear().toString()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const slug = post.properties['mp-slug'][0]

  return pattern
    .replace(':siteBaseUrl', config.get('siteBaseUrl'))
    .replace(':year', year)
    .replace(':month', month)
    .replace(':day', day)
    .replace(':slug', slug)
}
