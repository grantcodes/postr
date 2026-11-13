# Astro

`@postr/astro` loads your posts into [Astro content collections](https://docs.astro.build/en/guides/content-collections/).
It has two loaders:

- `postrLoader()` for `src/content.config.ts`. Posts are synced when the site builds.
- `postrLiveLoader()` for `src/live.config.ts`. Posts are read on every request, for on-demand
  rendered pages.

```bash
npm install @postr/astro@alpha
```

It needs Astro 6 or later and Node.js 24 or later.

## Choosing a source

Both loaders take one of three sources:

| Source                                      | Use it when                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `{ postr }`                                 | Astro runs in the same process as postr, e.g. postr serves Micropub from an Astro endpoint.                     |
| `{ database, siteUrl }`                     | The site builds on the machine that holds the database. It is opened [read-only](./getting-started.md#options). |
| `{ endpoint, token, siteUrl?, postTypes? }` | The site builds somewhere else, e.g. in CI. Posts are read from Micropub `q=source`.                            |

The HTTP source sends `token` as a bearer token; any valid token works, no scope is needed.
`siteUrl` defaults to the endpoint's origin. Fetched references (`data.references`) are only
available from the in-process sources. Post types are discovered from the mf2, so pass the same
custom `postTypes` your server uses.

## Build-time collections

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content'
import { postrLoader } from '@postr/astro'

export const collections = {
  posts: defineCollection({
    loader: postrLoader({
      endpoint: 'https://example.com/micropub',
      token: import.meta.env.POSTR_TOKEN,
    }),
  }),
  notes: defineCollection({
    loader: postrLoader({
      database: './postr.db',
      siteUrl: 'https://example.com',
      postType: 'note',
    }),
  }),
}
```

| Option       | Default      | Description                                                                       |
| ------------ | ------------ | --------------------------------------------------------------------------------- |
| `postType`   | all          | Only posts of this type, e.g. `note`.                                             |
| `category`   | all          | Only posts in this category.                                                      |
| `visibility` | `['public']` | Visibilities to include, e.g. `['public', 'unlisted']`.                           |
| `drafts`     | `false`      | Include drafts.                                                                   |
| `onError`    | see below    | `throw` fails the sync; `warn` logs and keeps the entries from the previous sync. |

A failed sync throws during `astro build`, so a backend outage never deploys an empty site. In
`astro dev` it warns and keeps the previous entries instead.

Each sync reads every post, but only re-parses the ones that changed and removes the ones that
were deleted, drafted or hidden. Static sites still need a rebuild after you post, e.g. from a
deploy hook.

## Live collections

```ts
// src/live.config.ts
import { defineLiveCollection } from 'astro:content'
import { postrLiveLoader } from '@postr/astro'
import { postr } from './lib/postr' // the instance that serves Micropub

export const collections = {
  posts: defineLiveCollection({ loader: postrLiveLoader({ postr }) }),
}
```

```astro
---
import { getLiveCollection, getLiveEntry } from 'astro:content'

const { entries } = await getLiveCollection('posts', { postType: 'note', limit: 20, offset: 0 })
const { entry } = await getLiveEntry('posts', { url: 'https://example.com/2026/06/04/hello' })
const { entries: results } = await getLiveCollection('posts', { search: Astro.url.searchParams.get('q') ?? '' })
---
```

Collection filters are `postType`, `category`, `search`, `limit` and `offset`. Entries are
looked up by `id` or `url`; missing and filtered-out posts are not found. Errors are returned,
not thrown, and every result has a cache hint.

## Entries

`entry.id` is the post's permalink path without the leading slash, e.g. `2026/06/04/hello`.
`entry.data` has:

| Field                                           | Description                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `url`, `path`                                   | Permalink and its path.                                          |
| `type`, `postType`                              | mf2 type (`h-entry`) and discovered post type (`note`).          |
| `name`, `summary`                               | Optional. `name` is dropped when it only repeats the content.    |
| `content`                                       | Optional `{ html, text }`.                                       |
| `published`, `updated`                          | `Date`s.                                                         |
| `status`, `visibility`                          | `published`/`draft` and `public`/`unlisted`/`private`.           |
| `categories`                                    | Category names; person tags stay in `properties`.                |
| `photos`, `videos`, `audio`, `featured`         | Media URLs; photos are `{ url, alt?, width?, height?, sizes? }`. |
| `inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf` | URLs the post responds to.                                       |
| `syndication`                                   | Syndicated copies.                                               |
| `references`                                    | Fetched h-entries of those URLs, keyed by URL.                   |
| `properties`                                    | The full mf2 properties, as `q=source` returns them.             |

A reference whose page links to a JSON oEmbed endpoint has its response in
`references[url].properties.oembed[0]`: `{ type, html?, url?, title?, author_name?, provider_name?, thumbnail_url?, width?, height? }`.
postr stores the provider's `html` as is, so your site decides which iframes to trust. Render it
only for hosts you allow:

```astro
---
const trusted = new Set(['www.youtube.com', 'vimeo.com'])
const url = entry.data.bookmarkOf[0]
const oembed = entry.data.references[url]?.properties.oembed?.[0] as { html?: string } | undefined
---

{oembed?.html && trusted.has(new URL(url).hostname) ? <Fragment set:html={oembed.html} /> : <a href={url}>{url}</a>}
```

Posts with content have rendered HTML, so `render(entry)` and `<Content />` work.

A collection `schema` replaces the loader's. Extend `postSchema` to keep its fields:

```ts
import { z } from 'astro/zod'
import { postrLoader, postSchema } from '@postr/astro'

defineCollection({
  loader: postrLoader({ database: './postr.db', siteUrl: 'https://example.com' }),
  schema: postSchema.extend({ readingTime: z.number().default(1) }),
})
```

## Pages

A blog index, newest first:

```astro
---
// src/pages/index.astro
import { getCollection } from 'astro:content'

const posts = (await getCollection('posts')).sort(
  (a, b) => b.data.published.getTime() - a.data.published.getTime()
)
---

<ul>
  {posts.map((post) => <li><a href={post.data.path}>{post.data.name ?? post.data.content?.text}</a></li>)}
</ul>
```

A page per post, at its permalink:

```astro
---
// src/pages/[...slug].astro
import { getCollection, render } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }))
}

const { post } = Astro.props
const { Content } = await render(post)
---

<article>
  {post.data.name && <h1>{post.data.name}</h1>}
  <Content />
</article>
```

A page per category:

```astro
---
// src/pages/category/[category].astro
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  const categories = [...new Set(posts.flatMap((post) => post.data.categories))]
  return categories.map((category) => ({
    params: { category },
    props: { posts: posts.filter((post) => post.data.categories.includes(category)) },
  }))
}
---
```

If you load unlisted posts so they get a page, filter them out of indexes and feeds with
`getCollection('posts', (post) => post.data.visibility === 'public')`.

## Images

Postr media URLs are absolute. To optimise them with `astro:assets`, allow the media host in
`image.remotePatterns`; it must be reachable during the build:

```astro
<Image src={photo.url} alt={photo.alt ?? ''} inferSize />
```

Otherwise use a plain `<img>`. Photos in postr's local media store have `width`, `height` and
`sizes` (the resized `imageSizes` copies), enough for a responsive image without layout shift:

```astro
<img
  src={photo.url}
  alt={photo.alt ?? ''}
  width={photo.width}
  height={photo.height}
  srcset={Object.values(photo.sizes ?? {})
    .map((size) => `${size.url} ${size.width}w`)
    .concat(photo.width ? [`${photo.url} ${photo.width}w`] : [])
    .join(', ') || undefined}
  sizes="(min-width: 60rem) 60rem, 100vw"
/>
```
