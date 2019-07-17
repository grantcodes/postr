const emojiList = require('emojis-list')

/**
 * Checks if a string is a single emoji
 * @param {string} text String to test
 */
const isSingleEmoji = text => {
  text = text.trim()
  return emojiList.indexOf(text) > -1
}

const postTypes = [
  {
    type: 'note',
    name: 'Note',
  },
  {
    type: 'article',
    name: 'Article',
  },
  {
    type: 'photo',
    name: 'Photo',
  },
  {
    type: 'video',
    name: 'Video',
  },
  {
    type: 'audio',
    name: 'Audio',
  },
  {
    type: 'reply',
    name: 'Reply',
  },
  {
    type: 'like',
    name: 'Like',
  },
  {
    type: 'repost',
    name: 'Repost',
  },
  {
    type: 'rsvp',
    name: 'RSVP',
  },
  {
    type: 'bookmark',
    name: 'Bookmark',
  },
  {
    type: 'reacji',
    name: 'Reacji',
  },
  {
    type: 'listen',
    name: 'Listen',
  },
  {
    type: 'read',
    name: 'Read',
  },
  {
    type: 'watch',
    name: 'watch',
  },
  {
    type: 'event',
    name: 'event',
  },
  {
    type: 'checkin',
    name: 'Checkin',
  },
  {
    type: 'quotation',
    name: 'Quotation',
  },
  {
    type: 'collection',
    name: 'Collection',
  },
]

const postTypeExtenders = []

/**
 * Add a custom post type
 * @param {object} options The post type options. Must include am id, name and discovery function that
 *                         accepts an mf2 item and returns a boolean indicating if the post is of the custom type
 */
const addPostType = ({ id, name, discovery }) => {
  if (!id || !name || !discovery) {
    throw new Error('Custom post type is missing required options')
  }
  postTypes.push({
    type: id,
    name: name,
  })
  postTypeExtenders.push({ id, discovery })
}

/**
 * Discover the post type from a mf2 json object.
 * Mostly borrowed from https://github.com/EdwardHinkle/abode. Thanks Eddie
 * @param {object} post A mf2 json object
 */
const getPostType = post => {
  // First run through any custom functions for detecting post types
  for (const type of postTypeExtenders) {
    const isCustomType = type.discovery(post)
    if (isCustomType) {
      return type.id
    }
  }

  // If this isn't an entry count it as a different post type
  if (
    post.type &&
    post.type[0] !== 'h-entry' &&
    post.type[0].startsWith('h-')
  ) {
    return post.type[0].substring(2)
  }

  // Then continue to base post type discovery
  if (post.properties.rsvp) {
    return 'rsvp'
  }
  if (post.properties['in-reply-to']) {
    if (post.properties.content && post.properties.content[0]) {
      let content = post.properties.content[0]
      if (typeof content !== 'string') {
        if (content.value) {
          content = content.value
        } else if (content.html) {
          content = content.html
        }
      }
      if (isSingleEmoji(content)) {
        return 'reacji'
      }
    }
    return 'reply'
  }
  if (post.properties['repost-of']) {
    return 'repost'
  }
  if (post.properties['bookmark-of']) {
    return 'bookmark'
  }
  if (post.properties['quotation-of']) {
    return 'quotation'
  }
  if (post.properties['like-of']) {
    return 'like'
  }
  if (post.properties.checkin) {
    return 'checkin'
  }
  if (post.properties['listen-of']) {
    return 'listen'
  }
  if (post.properties['read-of']) {
    return 'read'
  }
  if (post.properties.start) {
    return 'event'
  }
  if (
    post.properties['watch-of'] ||
    post.properties.show_name ||
    post.properties.movie_name
  ) {
    return 'watch'
  }
  if (post.properties.isbn) {
    return 'book'
  }
  if (post.properties.video) {
    return 'video'
  }
  if (post.properties.audio) {
    return 'audio'
  }
  if (post.properties.ate) {
    return 'ate'
  }
  if (post.properties.drank) {
    return 'drank'
  }
  if (post.children && Array.isArray(post.children)) {
    return 'collection'
  }
  if (post.properties.photo) {
    return 'photo'
  }
  if (post.properties.name && post.properties.name != '') {
    return 'article'
  }

  return 'note'
}

module.exports = {
  getPostType,
  getAvailablePostTypes: () => postTypes,
  addPostType,
}
