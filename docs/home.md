# Postr

A library-first IndieWeb backend for Node.js: a Micropub server, media endpoint and typed
post API backed by a single SQLite file.

## Features

- Micropub create, update, delete and undelete, plus `q=config`, `source`, `category`, `syndicate-to` and `post-types` queries
- Media endpoint with local file storage and optional image resizing
- Markdown content, `#hashtag` categories and post type discovery
- Typed JavaScript API for reading and writing posts
- Outgoing webmentions, reference fetching (microformats or Readability) and syndication, retried in the background
- Plugins for feeds, receiving webmentions, Telegram, Instagram and WebSub

## Install

```bash
npm install @postr/core
```

Requires Node.js 24 or later (postr uses the built-in `node:sqlite`).

## Usage

`createPostr()` opens (and migrates) the database and returns the post API and a
[Hono](https://hono.dev) app. The app serves Micropub at the path of `endpointUrl`.

```ts
import { serve } from '@hono/node-server'
import { createPostr } from '@postr/core'

const postr = createPostr({
  siteUrl: 'https://example.com',
  endpointUrl: 'https://example.com/micropub',
  database: './postr.db',
  auth: { tokenEndpoint: 'https://tokens.indieauth.com/token' },
  media: { dir: './media', url: 'https://example.com/media' },
})

serve({ fetch: postr.fetch, port: 3000 })
```

`postr.fetch` is a standard `(Request) => Response` handler, so it also works as a Next.js
route handler or an Astro endpoint:

```ts
// app/micropub/[[...path]]/route.ts
export const GET = postr.fetch
export const POST = postr.fetch
```

Postr does not serve the media directory; serve `media.dir` at `media.url` yourself.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `siteUrl` | required | Your site, e.g. `https://example.com`. Post URLs are `siteUrl + path`. |
| `endpointUrl` | required | Public URL of the Micropub endpoint. Its path is where the app serves Micropub. |
| `auth` | required | See [Authentication](#authentication). |
| `database` | `postr.db` | SQLite file path, or `:memory:`. |
| `permalinkPattern` | `/:year/:month/:day/:slug` | Path of new posts. Uses the date as written in `published`. Existing posts keep their path. |
| `media` | none | `{ dir, url, imageSizes? }` for local storage, or any object with `save(file): Promise<url>`. Without it uploads are rejected. |
| `media.imageSizes` | none | Resized copies, e.g. `{ thumbnail: [200, 200], large: [1800] }`, written as `name-thumbnail.jpg`. Needs `sharp` installed. |
| `plugins` | `[]` | See [Plugins](plugins.md). |
| `formatContent` | `true` | Treat plain content as Markdown and store `{ html, value }`; add `#hashtags` to `category`. |
| `fetchReferences` | `true` | Fetch and cache the posts you reply to, like, repost or bookmark. |
| `sendWebmentions` | `true` | Send webmentions to every URL a post links to. |
| `downloadExternalMedia` | `true` | Copy external `photo`, `video` and `audio` URLs into the media store when a post is created. |
| `micropubConfig` | `{}` | Extra values merged into the `q=config` response. |
| `runJobs` | `true` | Run queued webmentions, reference fetches and syndication in the background. |
| `logger` | `console` | Any object with `info`, `warn` and `error`. |
| `fetch` | global `fetch` | Used for every outgoing request. |

### Authentication

| `auth` option | Description |
| --- | --- |
| `tokenEndpoint` | Verify bearer tokens with an IndieAuth token endpoint. The token's `me` must match `siteUrl`. |
| `verify(token)` | Custom verification, e.g. token introspection. Return `{ me, scope: string[] }` or `null`. |
| `dangerousToken` | A fixed token accepted with every scope. For development and tests. |
| `dangerousAllowAll` | Accept every request. For local development only. |

Scopes: `create` (or `post`) to create and upload media, `update`, `delete`, and `undelete`
(or `create`).

## Posts API

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
await postr.posts.categories()
await postr.posts.references(post) // fetched h-entries of the URLs the post responds to
postr.posts.toMf2(post) // full mf2 JSON, as returned by q=source
```

`list()` returns published, public posts by default; pass `includeHidden: true` to include
drafts, unlisted and private posts. Deleted posts are never listed. Other filters: `exists`,
`notExists`, `properties` (property contains a value) and `order` (`desc` by default).

## Migrating from 1.x

2.0 is a clean break: SQLite replaces RxDB, Hono replaces Express, and plugins are plain
objects. To move your posts:

1. On 1.x, dump the posts collection:

   ```js
   const collection = await endpoint.getCollection()
   fs.writeFileSync('dump.json', JSON.stringify(await collection.dump()))
   ```

2. Import it, with `TZ` set to the old server's timezone so permalink dates match:

   ```bash
   TZ=Europe/Berlin npx postr-import-legacy --dump dump.json --site-url https://example.com \
     --media-url https://example.com/media --database postr.db --dry-run
   ```

   Drop `--dry-run` to write the database. Ids, permalinks, dates, received webmentions and
   deleted posts are kept; nothing is re-sent. `importLegacyPosts()` does the same from code.
