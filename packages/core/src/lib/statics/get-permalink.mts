import { isRxDocument } from 'rxdb'
import getPermalinkFromMf2 from '../get-permalink-from-mf2.mjs'

export default function getPermalink(this: any): string {
  let post = this
  if (isRxDocument(post)) {
    post = post.toMf2()
  }
  return getPermalinkFromMf2(post)
}
