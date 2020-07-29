const ptd = require('./post-type-discovery')

test('exposes properties', () => {
  expect(typeof ptd).toEqual('object')
  expect(ptd).toHaveProperty('getPostType')
  expect(ptd).toHaveProperty('getAvailablePostTypes')
  expect(ptd).toHaveProperty('addPostType')
})

test('add custom post type requires params', () => {
  expect(() => ptd.addPostType({ id: 'test' })).toThrowError()
})

test('add custom post type', () => {
  ptd.addPostType({
    id: 'test',
    name: 'Test Post',
    discovery: (post) => {
      if (
        post &&
        post.properties &&
        post.properties.category &&
        post.properties.category.includes('test-ptd')
      ) {
        return true
      }
      return false
    },
  })
  const actual = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      content: ['This is a test post type'],
      category: ['test-ptd', 'cool'],
    },
  })
  expect(actual).toEqual('test')
})

test('note', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: { content: ['This is a note'] },
  })
  expect(res).toEqual('note')
})

test('article', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: { name: ['Title'], content: ['This is an article'] },
  })
  expect(res).toEqual('article')
})

test('photo', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      name: ['Title'],
      content: ['This is a photo'],
      photo: ['https://placeimg.com/300/300'],
    },
  })
  expect(res).toEqual('photo')
})

test('video', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      name: ['Title'],
      content: ['This is a video'],
      video: ['https://placeimg.com/300/300'],
    },
  })
  expect(res).toEqual('video')
})

test('audio', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      name: ['Title'],
      content: ['This is an audio'],
      audio: ['https://placeimg.com/300/300'],
    },
  })
  expect(res).toEqual('audio')
})

test('reply', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      content: ['This is a reply'],
      'in-reply-to': ['https://example.com'],
    },
  })
  expect(res).toEqual('reply')
})

test('like', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      content: ['This is a like'],
      'like-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('like')
})

test('repost', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'repost-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('repost')
})

test('bookmark', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'bookmark-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('bookmark')
})

test('read', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'read-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('read')
})

test('listen', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'listen-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('listen')
})

test('watch', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'watch-of': ['https://example.com'],
    },
  })
  expect(res).toEqual('watch')
})

test('checkin', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      checkin: ['https://example.com/place'],
    },
  })
  expect(res).toEqual('checkin')
})

test('quotation', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'quotation-of': ['https://example.com'],
      content: ['This is a quotation'],
    },
  })
  expect(res).toEqual('quotation')
})

test('rsvp', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      rsvp: ['yes'],
      'in-reply-to': ['https://example.com/event'],
      content: ['I am going to this event'],
    },
  })
  expect(res).toEqual('rsvp')
})

test('collection', () => {
  const res = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      name: ['Collection'],
    },
    children: [
      {
        type: ['h-entry'],
        properties: {
          content: ['I am a child'],
        },
      },
    ],
  })
  expect(res).toEqual('collection')
})

test('event', () => {
  const res = ptd.getPostType({
    type: ['h-event'],
    properties: {
      name: ['My event'],
      start: ['1999-01-01'],
    },
  })
  expect(res).toEqual('event')
})

test('recipe', () => {
  const res = ptd.getPostType({
    type: ['h-recipe'],
    properties: {
      name: ['My recipe'],
      instructions: ['Do stuff'],
    },
  })
  expect(res).toEqual('recipe')
})

test('reacji', () => {
  const simple = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'in-reply-to': ['https://example.com'],
      content: ['👍'],
    },
  })
  expect(simple).toEqual('reacji')
  const complex = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'in-reply-to': ['https://example.com'],
      content: ['👨‍👨‍👧‍👧'],
    },
  })
  expect(complex).toEqual('reacji')
  const skintone = ptd.getPostType({
    type: ['h-entry'],
    properties: {
      'in-reply-to': ['https://example.com'],
      content: ['👩🏿‍⚖️'],
    },
  })
  expect(skintone).toEqual('reacji')
})
