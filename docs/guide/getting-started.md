# Getting started

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

To build an Astro site from your posts, use the [Astro content loaders](./astro.md).

### Options

| Option                  | Default                    | Description                                                                                                                    |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `siteUrl`               | required                   | Your site, e.g. `https://example.com`. Post URLs are `siteUrl + path`.                                                         |
| `endpointUrl`           | required                   | Public URL of the Micropub endpoint. Its path is where the app serves Micropub.                                                |
| `auth`                  | required                   | See [Authentication](#authentication).                                                                                         |
| `database`              | `postr.db`                 | SQLite file path, or `:memory:`.                                                                                               |
| `permalinkPattern`      | `/:year/:month/:day/:slug` | Path of new posts. Uses the date as written in `published`. Existing posts keep their path.                                    |
| `media`                 | none                       | `{ dir, url, imageSizes? }` for local storage, or any object with `save(file): Promise<url>`. Without it uploads are rejected. |
| `media.imageSizes`      | none                       | Resized copies, e.g. `{ thumbnail: [200, 200], large: [1800] }`, written as `name-thumbnail.jpg`. Needs `sharp` installed.     |
| `plugins`               | `[]`                       | See [Plugins](./plugins.md).                                                                                                   |
| `formatContent`         | `true`                     | Treat plain content as Markdown and store `{ html, value }`; add `#hashtags` to `category`.                                    |
| `fetchReferences`       | `true`                     | Fetch and cache the posts you reply to, like, repost or bookmark, with their oEmbed data. `{ oembed: false }` skips oEmbed.    |
| `sendWebmentions`       | `true`                     | Send webmentions to every URL a post links to.                                                                                 |
| `downloadExternalMedia` | `true`                     | Copy external `photo`, `video` and `audio` URLs into the media store when a post is created.                                   |
| `micropubConfig`        | `{}`                       | Extra values merged into the `q=config` response.                                                                              |
| `runJobs`               | `true`                     | Run queued webmentions, reference fetches and syndication in the background.                                                   |
| `readOnly`              | `false`                    | Open an existing database read-only: no migrations, no jobs, and every write fails with `forbidden`.                           |
| `logger`                | `console`                  | Any object with `info`, `warn` and `error`.                                                                                    |
| `fetch`                 | global `fetch`             | Used for every outgoing request.                                                                                               |

### Authentication

| `auth` option       | Description                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `tokenEndpoint`     | Verify bearer tokens with an IndieAuth token endpoint. The token's `me` must match `siteUrl`. |
| `verify(token)`     | Custom verification, e.g. token introspection. Return `{ me, scope: string[] }` or `null`.    |
| `dangerousToken`    | A fixed token accepted with every scope. For development and tests.                           |
| `dangerousAllowAll` | Accept every request. For local development only.                                             |

Scopes: `create` (or `post`) to create and upload media, `update`, `delete`, and `undelete`
(or `create`).
