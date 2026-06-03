# Postr

## What is this?

This is a nodejs IndieWeb backend, mainly consisting of a micropub endpoint that can be run as a module in an express project.

It includes a bunch of cool features (or I think they're cool anyway...)

### Features

- Supports micropub posting, actions and queries
- Media endpoint
- Automatically downloads images to your local media folder
- Image resizing
- Markdown parsing
- Automatic webmention sending
- Grabs referenced urls as microformats2
- Highly extensible via middleware
- Supports multiple database adapters
- Realtime updates and data replication

## Example Site

An example site is available to play around with on glitch at https://glitch.com/~postr

## Install

```bash
npm install @postr/core
```

Once installed, `@postr/core` resolves as a bare specifier inside any ESM module in your project — no `createRequire` or relative path needed.

## Usage

```js
import express from 'express'
import { postr } from '@postr/core'

const app = express()
const endpoint = postr({ /* config */ })
app.use('/micropub', endpoint.router)
app.listen(80)
```

### Config

Configuration can be passed as an object when using postr as a JavaScript module.

#### Options

```js
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const options = {
  permalinkPattern: ':siteBaseUrl/:year/:month/:day/:slug', // (String) What your site permalinks look like. Written in express style. Must include year month and day at the moment
  sendWebmentions: true, // (Boolean) Send webmentions automatically or not
  formatContent: true, // (Boolean) Whether or not to format plain text content
  getRefs: true, // (Boolean) Enables parsing of referenced urls
  downloadExternalMedia: true, // (Boolean) Whether or not to download referenced media files (`photo`, `audio` and `video` properties). They will be saved to the default media endpoint
  syndication: [], // (Array) - Your syndication providers that will be returned in micropub config queries
  mediaDir: __dirname + '/../media', // (String) The local media directory
  dbName: 'micropubendpoint', // (String) The database name. Note: Must adhere to RxDB rules
  dbAdapter: 'leveldb', // (String|Object) The database adapter. Note: To use a different adapter you must also load the appropriate RxDB plugin
  imageSizes: {}, // (Object) A set of sizes to scale images to. should be in the format `{name: [width, height]}` eg. `{thumbnail: [200, 200], large: [1800, 0]}`, Note: If you pass 0 as the height the image will retain its original ratio
  siteBaseUrl: '', // (String)* The base url of your website with no trailing slash. Eg. `https://grant.codes`
  endpointBaseUrl: '', // (String)* The base url of this media endpoint with no trailing slash. Eg. `https://micropub.grant.codes` or `https://grant.codes/micropub`
  mediaBaseUrl: '', // (String)* The base url of your media folder. You should statically serve the `mediaDir` and set this option to the url
  dbPassword: '', // (String)* The database password
  tokenEndpoint: '', // (String)* Your token endpoint. Used for authenticating requests
  dangerousDevMode: false, // (Boolean) Set to true and the endpoint will skip checking tokens. It may do more in the future
  dangerousPermanentToken: '', // (String) A permanent auth token that may be useful if you are using your own tools to communicate with your site
  mediaEndpoint: '', // (String) If you want to post media to a different media endpoint pass the url here and all file storage will be handled by your media endpoint. No image resizing will be done.
}
```

## Development

This repository is a [pnpm workspace](https://pnpm.io/workspaces) monorepo. The repo root is a non-publishable workspace/meta root with orchestration scripts only. The publishable `@postr/core` package lives in `packages/core/`, alongside several other publishable packages under `packages/`.

### Prerequisites

- Node.js 24+ (pinned in `.node-version` for Vite+ / `vp env`)
- [pnpm](https://pnpm.io/installation) 11+

### Quick start

```bash
# Install all dependencies
pnpm install

# Or, if you have Vite+ (vp) installed:
vp install
```

### Smoke testing

The real smoke test is `pnpm run test-server`, which starts an Express app on `http://localhost:3000/micropub` using test fixtures in `tests/_tmp/`.

```bash
pnpm run test-server
```

The root `npm test` script intentionally exits with an error — do not use it as a verification path.

### Publishing

All packages in this workspace publish ESM source, with TypeScript-compiled output where applicable (`@postr/core`, `@postr/plugin`). The root `build` script compiles the packages that need it and is a no-op for source-only packages.

### Package verification

```bash
pnpm run check
```

This builds all packages (compiling TypeScript where needed) then runs `pnpm -r pack --dry-run` to verify every workspace package is in publishable shape.

You can also run dry-run packing independently:

```bash
pnpm -r pack --dry-run
```

### Using Vite+ (`vp`)

If you have [Vite+](https://viteplus.dev) installed, `vp` can serve as an alternative orchestration layer that delegates to pnpm:

```bash
vp install          # install all dependencies
vp run test-server  # start smoke-test server
vp run build        # compiles TS packages, no-op for source-only packages
vp exec <cmd>       # run a command from node_modules/.bin
vp pm pack -r -- --dry-run # verify all packages are publishable
```

`vp` respects the same workspace configuration and works transparently alongside `pnpm` commands.

This repo intentionally does **not** add a `vite.config.ts` yet. Vite+ is currently used as an orchestration/runtime layer here, not as a Vite app/library config surface.

### CI / publish

See `.github/workflows/npm-publish.yml` for the automated publish workflow. It validates all packages (install, build, verify packaging) before publishing each workspace package individually via `pnpm --filter <package> publish`.
