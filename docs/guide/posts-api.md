# Posts API

Posts are stored as mf2 JSON. `published`, `updated`, `post-status` and `visibility` are kept as
columns and added back by `posts.toMf2()`; Micropub commands (`mp-*`) are never stored.

```ts
const post = await postr.posts.create({
  type: ['h-entry'],
  properties: { content: ['Hello **world** #indieweb'], 'mp-slug': ['hello'] },
})
post.url // https://example.com/2026/06/04/hello
post.properties.content // [{ html: '<p>Hello <strong>world</strong> #indieweb</p>', value: 'Hello world #indieweb' }]

await postr.posts.update(post.url, { replace: { name: ['Hi'] }, add: { category: ['news'] } })
await postr.posts.delete(post.url)
await postr.posts.undelete(post.url)

await postr.posts.get(post.id)
await postr.posts.getByUrl(post.url)
await postr.posts.list({ postType: 'note', category: 'indieweb', limit: 20, offset: 0 })
await postr.posts.list({ search: 'creme brul' }) // full-text search
await postr.posts.categories()
await postr.posts.references(post) // fetched h-entries of the URLs the post responds to
postr.posts.toMf2(post) // full mf2 JSON, as returned by q=source
```

Photos are stored as objects. Images in the local media store also get their dimensions and
resized copies (see [Image dimensions](./getting-started.md#image-dimensions)):

```ts
post.properties.photo
// [{
//   value: 'https://example.com/media/2026/06/04/cat.jpg',
//   alt: 'A cat',
//   width: 4000,
//   height: 3000,
//   sizes: { '1800': { url: 'https://example.com/media/2026/06/04/cat-1800.jpg', width: 1800, height: 1350 } },
// }]
```

`list()` returns published, public posts by default; pass `includeHidden: true` to include
drafts, unlisted and private posts. Deleted posts are never listed. Other filters: `exists`,
`notExists`, `properties` (property contains a value) and `order` (`desc` by default).

`search` matches the words of `name`, `summary`, `content` and `category`, using SQLite's
full-text index. Every word must match, as a prefix, ignoring case and accents; results stay in
date order. Micropub clients get the same through `q=source&search=<text>`.
