# Postr

A library-first IndieWeb backend for Node.js: a Micropub server, media endpoint and typed post
API on a single SQLite file, with plugins for feeds, webmentions and syndication.

```ts
import { createPostr } from '@postr/core'

const postr = createPostr({
  siteUrl: 'https://example.com',
  endpointUrl: 'https://example.com/micropub',
  auth: { tokenEndpoint: 'https://tokens.indieauth.com/token' },
  media: { dir: './media', url: 'https://example.com/media' },
})

export default { fetch: postr.fetch }
```

Documentation: [usage, options and posts API](docs/home.md), [plugins](docs/plugins.md),
including [migrating from 1.x](docs/home.md#migrating-from-1x).

## Packages

| Package | Description |
| --- | --- |
| [`@postr/core`](packages/core) | Storage, posts API, Micropub and media endpoints, plugin runtime |
| [`@postr/plugin-feeds`](packages/plugin-feeds) | RSS, Atom, JSON Feed, JF2 and mf2 feeds |
| [`@postr/plugin-webmention-endpoint`](packages/plugin-webmention-endpoint) | Receive webmentions |
| [`@postr/syndicator-telegram`](packages/syndicator-telegram) | Syndicate to a Telegram channel |
| [`@postr/syndicator-instagram`](packages/syndicator-instagram) | Syndicate photos to Instagram |
| [`@postr/syndicator-superfeedr`](packages/syndicator-superfeedr) | WebSub publish pings |

## Development

A pnpm workspace (Node.js 24+, pnpm 11+). All code is strict TypeScript; tests use Node's
built-in runner and run the `.ts` sources directly.

```bash
pnpm install
pnpm run build       # compile every package to dist/
pnpm run typecheck
pnpm test
pnpm run check       # build, typecheck, test and dry-run pack
pnpm run test-server # Micropub on http://localhost:3000/micropub (PORT to change), token "token"
```

`@postr/core` schema changes: edit `packages/core/src/db/schema.ts`, then run
`pnpm --filter @postr/core db:generate` to add a migration under `packages/core/drizzle/`.

Releases use release-please in manifest mode with npm trusted publishing: pushes to `dev`
publish prereleases to the `next` tag, pushes to `master` publish to `latest`.
