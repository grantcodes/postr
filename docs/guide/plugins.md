# Plugins

Plugins are passed to `createPostr({ plugins: [...] })`. Each package exports a function that
returns a plugin.

## Feeds

```bash
npm install @postr/plugin-feeds
```

```ts
import { feeds } from '@postr/plugin-feeds'

createPostr({
  ...options,
  plugins: [feeds({ author: { name: 'Grant', photo: 'https://example.com/me.jpg' } })],
})
```

Serves public posts at `<endpoint>/plugin/feeds/<format>` where format is `rss`, `atom`, `json`
(JSON Feed), `jf2` or `mf2json`. Append `/type/<post-type>`, `/category/<category>` or
`/page/<n>` to filter or page. Options: `author` (required), `title`, `limit` (default 50).

## Webmention endpoint

```bash
npm install @postr/plugin-webmention-endpoint
```

```ts
import { webmentionEndpoint } from '@postr/plugin-webmention-endpoint'

createPostr({
  ...options,
  plugins: [webmentionEndpoint({ notify: (entry, post) => console.log(entry) })],
})
```

Receives webmentions at `<endpoint>/plugin/webmention`. The source must link to the target. Its
h-entry is stored on the target post as `like`, `repost`, `bookmark`, `comment` or `mention`;
repeated mentions replace the stored copy, and a `410 Gone` source removes it.

## Syndication

Syndicators appear in `q=config` as `syndicate-to` targets. A post is syndicated when it is
published and public and either the client sends `mp-syndicate-to` with the target's uid or,
without `mp-syndicate-to`, the target is a default. The returned URL is added to
`syndication`. Failures are retried with backoff.

### Telegram

```ts
import { telegram } from '@postr/syndicator-telegram'

telegram({ token: 'BOT_TOKEN', channel: '@mychannel', default: true })
```

Uploads `featured`, `photo`, `audio` and `video` files, then posts the text. Likes and bookmarks
are skipped.

### Instagram

```ts
import { instagram } from '@postr/syndicator-instagram'

instagram({ username: 'me', password: 'secret', blurBackground: false })
```

Publishes photo posts (up to 10 photos as an album, resized to fit) and likes `instagram.com`
posts. For collections, each child photo post is published. Uses the unofficial
`instagram-private-api`, so it may break when Instagram changes.

### Superfeedr / WebSub

```ts
import { superfeedr } from '@postr/syndicator-superfeedr'

superfeedr({
  hub: 'https://example.superfeedr.com/',
  topic: ['https://example.com/', 'https://example.com/feed'],
})
```

Sends a WebSub `publish` ping for the topics after each published post.

## Writing a plugin

A plugin is an object. Every field except `id` is optional.

```ts
import type { PostrPlugin } from '@postr/core'

export function myPlugin(): PostrPlugin {
  return {
    id: 'my-plugin',
    name: 'My plugin',
    // Extra post types, checked before the built-in discovery.
    postTypes: [
      {
        type: 'weather',
        name: 'Weather',
        discovery: (item) => Boolean(item.properties.temperature),
      },
    ],
    // Transform a post before it is stored. Return the (new) mf2 item; do not write anything.
    beforeSave(item, ctx) {
      return item
    },
    // React to a committed create/update/delete/undelete.
    async afterSave(event, ctx) {
      if (event.origin === 'plugin:my-plugin') return
      await ctx.postr.posts.update(
        event.post.id,
        { add: { category: ['seen'] } },
        { origin: 'plugin:my-plugin' }
      )
    },
    // Routes mounted at <endpoint>/plugin/my-plugin
    routes(app, ctx) {
      app.get('/', (c) => c.json({ ok: true }))
    },
    // Make it a syndication target.
    syndication: {
      default: false,
      async syndicate(post, ctx) {
        return 'https://elsewhere.example/copy'
      },
    },
  }
}
```

`ctx` gives access to `postr`, `siteUrl`, `endpointUrl`, `log` and `fetch`.

Every write records an `origin`: `user` for Micropub and API calls unless you pass another.
Built-in side effects (webmentions, reference fetching, syndication) only run for `user` changes,
and a plugin that writes back should use its own origin and ignore events with it, so writes
cannot loop.
