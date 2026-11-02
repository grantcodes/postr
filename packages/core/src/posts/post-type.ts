import { firstString, type Mf2Item } from '../mf2.ts'

export interface PostTypeDefinition {
  type: string
  name: string
  /** Custom discovery, checked before the built-in rules. */
  discovery?: (post: Mf2Item) => boolean
}

export const builtInPostTypes: PostTypeDefinition[] = [
  { type: 'note', name: 'Note' },
  { type: 'article', name: 'Article' },
  { type: 'photo', name: 'Photo' },
  { type: 'video', name: 'Video' },
  { type: 'audio', name: 'Audio' },
  { type: 'reply', name: 'Reply' },
  { type: 'like', name: 'Like' },
  { type: 'repost', name: 'Repost' },
  { type: 'rsvp', name: 'RSVP' },
  { type: 'bookmark', name: 'Bookmark' },
  { type: 'reacji', name: 'Reacji' },
  { type: 'listen', name: 'Listen' },
  { type: 'read', name: 'Read' },
  { type: 'watch', name: 'Watch' },
  { type: 'event', name: 'Event' },
  { type: 'checkin', name: 'Checkin' },
  { type: 'quotation', name: 'Quotation' },
  { type: 'collection', name: 'Collection' },
]

const singleEmoji = /^\p{RGI_Emoji}$/v

/** Post type discovery: https://ptd.spec.indieweb.org/ plus the extra types postr has always used. */
export function discoverPostType(
  post: Mf2Item,
  custom: PostTypeDefinition[] = [],
): string {
  for (const definition of custom) {
    if (definition.discovery?.(post)) return definition.type
  }

  const [type] = post.type
  if (type && type !== 'h-entry' && type.startsWith('h-')) return type.slice(2)

  const has = (key: string) => (post.properties[key]?.length ?? 0) > 0
  if (has('rsvp')) return 'rsvp'
  if (has('in-reply-to')) {
    const content = firstString(post.properties, 'content')?.trim()
    return content && singleEmoji.test(content) ? 'reacji' : 'reply'
  }
  if (has('repost-of')) return 'repost'
  if (has('bookmark-of')) return 'bookmark'
  if (has('quotation-of')) return 'quotation'
  if (has('like-of')) return 'like'
  if (has('checkin')) return 'checkin'
  if (has('listen-of')) return 'listen'
  if (has('read-of')) return 'read'
  if (has('start')) return 'event'
  if (has('watch-of') || has('show_name') || has('movie_name')) return 'watch'
  if (has('isbn')) return 'book'
  if (has('video')) return 'video'
  if (has('audio')) return 'audio'
  if (has('ate')) return 'ate'
  if (has('drank')) return 'drank'
  if (post.children?.length) return 'collection'
  if (has('photo')) return 'photo'
  if (firstString(post.properties, 'name')) return 'article'
  return 'note'
}
