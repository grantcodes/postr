# Postr

> **2.0 is in alpha.** This branch is a rewrite published as `@postr/core@alpha`; the APIs may still
> change. `npm install @postr/core` installs the stable 1.x release.

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

Documentation: [postr.dev](https://postr.dev) — [getting started](docs/guide/getting-started.md),
[posts API](docs/guide/posts-api.md), [plugins](docs/guide/plugins.md) and
[migrating from 1.x](docs/guide/migrating.md).

## Packages

| Package                                                                    | Description                                                      |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`@postr/core`](packages/core)                                             | Storage, posts API, Micropub and media endpoints, plugin runtime |
| [`@postr/plugin-feeds`](packages/plugin-feeds)                             | RSS, Atom, JSON Feed, JF2 and mf2 feeds                          |
| [`@postr/plugin-webmention-endpoint`](packages/plugin-webmention-endpoint) | Receive webmentions                                              |
| [`@postr/syndicator-telegram`](packages/syndicator-telegram)               | Syndicate to a Telegram channel                                  |
| [`@postr/syndicator-instagram`](packages/syndicator-instagram)             | Syndicate photos to Instagram                                    |
| [`@postr/syndicator-superfeedr`](packages/syndicator-superfeedr)           | WebSub publish pings                                             |

## Development

A pnpm workspace (Node.js 24+, pnpm 11+). All code is strict TypeScript; tests use Node's
built-in runner and run the `.ts` sources directly.

```bash
pnpm install
pnpm run build       # compile every package to dist/
vp check             # format, lint and type check
pnpm test
pnpm run check       # vp check, build, test, then publint + attw on each packed package
pnpm run test-server # Micropub on http://localhost:3000/micropub (PORT to change), token "token"
```

`@postr/core` schema changes: edit `packages/core/src/db/schema.ts`, then run
`pnpm --filter @postr/core db:generate` to add a migration under `packages/core/drizzle/`.

Releases use release-please in manifest mode with npm trusted publishing: pushes to `dev`
publish `-alpha.N` versions to the npm `alpha` tag, and pushes to `master` publish to `latest`.
See `AGENTS.md` for how 2.0 moves from alpha to stable.
