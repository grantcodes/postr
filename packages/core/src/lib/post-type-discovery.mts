import emojiList from 'emojis-list'

const isSingleEmoji = (text: string): boolean => {
  text = text.trim()
  return emojiList.indexOf(text) > -1
}

export interface PostType {
  type: string
  name: string
}

export interface PostTypeExtender {
  id: string
  discovery: (post: any) => boolean
}

const postTypes: PostType[] = [
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
  { type: 'watch', name: 'watch' },
  { type: 'event', name: 'event' },
  { type: 'checkin', name: 'Checkin' },
  { type: 'quotation', name: 'Quotation' },
  { type: 'collection', name: 'Collection' },
]

const postTypeExtenders: PostTypeExtender[] = []

export function addPostType({
  id,
  name,
  discovery,
}: {
  id: string
  name: string
  discovery: (post: any) => boolean
}): void {
  if (!id || !name || !discovery) {
    throw new Error('Custom post type is missing required options')
  }
  postTypes.push({ type: id, name })
  postTypeExtenders.push({ id, discovery })
}

export function getAvailablePostTypes(): PostType[] {
  return postTypes
}

export function getPostType(post: any): string {
  for (const ext of postTypeExtenders) {
    if (ext.discovery(post)) {
      return ext.id
    }
  }

  if (post.type && post.type[0] !== 'h-entry' && post.type[0].startsWith('h-')) {
    return post.type[0].substring(2)
  }

  if (post.properties.rsvp) return 'rsvp'
  if (post.properties['in-reply-to']) {
    if (post.properties.content && post.properties.content[0]) {
      let content = post.properties.content[0]
      if (typeof content !== 'string') {
        content = content.value || content.html || content
      }
      if (isSingleEmoji(content)) return 'reacji'
    }
    return 'reply'
  }
  if (post.properties['repost-of']) return 'repost'
  if (post.properties['bookmark-of']) return 'bookmark'
  if (post.properties['quotation-of']) return 'quotation'
  if (post.properties['like-of']) return 'like'
  if (post.properties.checkin) return 'checkin'
  if (post.properties['listen-of']) return 'listen'
  if (post.properties['read-of']) return 'read'
  if (post.properties.start) return 'event'
  if (post.properties['watch-of'] || post.properties.show_name || post.properties.movie_name) return 'watch'
  if (post.properties.isbn) return 'book'
  if (post.properties.video) return 'video'
  if (post.properties.audio) return 'audio'
  if (post.properties.ate) return 'ate'
  if (post.properties.drank) return 'drank'
  if (post.children && Array.isArray(post.children)) return 'collection'
  if (post.properties.photo) return 'photo'
  if (post.properties.name && post.properties.name !== '') return 'article'
  return 'note'
}
