/**
 * @postr/core — ESM + TypeScript entrypoint
 *
 * Wave 8: Genuine ESM leaf modules with globalThis bridge for CJS spine.
 *
 * ## CJS interop strategy
 *
 * **Wave 8 modules (this file's direct imports)**
 *   - Compiled to ESM (`.mjs`), imported directly.
 *   - Includes: config, generateSearch, post-type-discovery, placeholders,
 *     save-file, save-file-from-url, get-hentry, error, is-node,
 *     get-permalink-from-mf2, get-urls-from-mf2, today-media-path,
 *     append-to-filename, statics, schema modules.
 *
 * **Wave 9 CJS spine (loaded via createRequire)**
 *   - Copied from `lib/` as `.js` files during build.
 *   - Loaded via `createRequire` from this ESM context.
 *   - Includes: index.js (deleted — logic inlined here), db.js, plugins.js,
 *     router.js, middlewear/, db-middleware/.
 *   - These CJS files access Wave 8 ESM modules via globalThis.__postr,
 *     populated before any CJS require runs.
 *
 * **RxDB / PouchDB** (CJS-only packages)
 *   - All loaded via createRequire from the ESM context.
 *
 * **Express and friends**
 *   - CJS packages but generally ESM-safe in Node 24.
 *   - Loaded via createRequire for consistency.
 */

import { createRequire } from 'node:module'

// ===== ESM bridge — populated before CJS spine loads =====
;(globalThis as any).__postr = {}

// Wave 8 — genuine ESM leaf modules
import * as config from './lib/config.mjs'
import generateSearchFn from './lib/generate-search.mjs'
import {
  getPostType,
  getAvailablePostTypes,
  addPostType,
} from './lib/post-type-discovery.mjs'
import * as placeholders from './lib/placeholders.mjs'
import saveFileFn from './lib/save-file.mjs'
import saveFileFromUrlFn from './lib/save-file-from-url.mjs'
import getHEntryFn from './lib/get-hentry.mjs'
import MicropubError from './lib/error.mjs'
import isNode from './lib/is-node.mjs'
import getPermalinkFromMf2 from './lib/get-permalink-from-mf2.mjs'
import getUrlsFromMf2 from './lib/get-urls-from-mf2.mjs'
import todayMediaPathFn from './lib/today-media-path.mjs'
import appendToFilenameFn from './lib/append-to-filename.mjs'
import schema from './schema/base.mjs'
import migrationStrategies from './schema/migration-strategies.mjs'
import getPostSchema from './schema/postTypes.mjs'
import * as staticMethods from './lib/statics/index.mjs'

// Populate globalThis bridge before CJS spine is loaded
const bridge = (globalThis as any).__postr
bridge.config = config
bridge.generateSearch = generateSearchFn
bridge.getPostType = getPostType
bridge.getAvailablePostTypes = getAvailablePostTypes
bridge.addPostType = addPostType
bridge.placeholders = placeholders
bridge.saveFile = saveFileFn
bridge.saveFileFromUrl = saveFileFromUrlFn
bridge.getHEntry = getHEntryFn
bridge.MicropubError = MicropubError
bridge.isNode = isNode
bridge.getPermalinkFromMf2 = getPermalinkFromMf2
bridge.getUrlsFromMf2 = getUrlsFromMf2
bridge.todayMediaPath = todayMediaPathFn
bridge.appendToFilename = appendToFilenameFn
bridge.schema = schema
bridge.migrationStrategies = migrationStrategies
bridge.getPostSchema = getPostSchema
bridge.staticMethods = staticMethods
bridge.getPermalink = getPermalinkFromMf2
bridge.getUrls = getUrlsFromMf2
bridge.replaceMf2 = placeholders.replaceMf2

// ===== Wave 9 CJS spine =====
const require = createRequire(import.meta.url)
const { use, plugins } = require('./lib/plugins.js')
const micropubRouter = require('./lib/router.js')
const Collection = require('./lib/db.js')

// ===== Public API types =====

export interface PostrCore {
  use: (...args: unknown[]) => void
  plugins: Record<string, unknown>
  getCollection: () => Promise<unknown>
  router: unknown
  generateSearch: (text: string) => string
  addPostType: (options: { id: string; name: string; discovery: (post: any) => boolean }) => void
  micropubEndpoint: string
  mediaEndpoint: string
}

const requiredOptions = [
  'siteBaseUrl',
  'endpointBaseUrl',
  'permalinkPattern',
  'syndication',
  'mediaDir',
  'mediaBaseUrl',
  'dbAdapter',
  'dbName',
  'dbPassword',
  'tokenEndpoint',
]

// ===== Named exports =====

/**
 * Initialize and configure a Postr instance.
 */
export function postr(options: Record<string, unknown> = {}): PostrCore {
  try {
    for (const key in options) {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        config.set(key, (options as any)[key])
      }
    }
    config.required(requiredOptions)
    return {
      use,
      plugins,
      getCollection: Collection.get,
      router: micropubRouter,
      generateSearch: generateSearchFn,
      addPostType: addPostType,
      micropubEndpoint: config.get('baseUrl') + '/',
      mediaEndpoint:
        config.get('mediaEndpoint') || config.get('baseUrl') + '/media',
    }
  } catch (err) {
    console.log('Micropub setup err', err)
    return new Error(err as any) as any
  }
}
