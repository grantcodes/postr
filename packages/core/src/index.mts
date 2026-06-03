/**
 * @postr/core — ESM + TypeScript entrypoint
 *
 * Wave 9: All modules are native ESM. No globalThis bridge needed.
 *
 * ## CJS interop strategy
 *
 * **RxDB / PouchDB** (CJS-only packages)
 *   - All loaded via createRequire inside the consuming module (db.mjs, plugins.mjs).
 *
 * **Other CJS deps** (file-type, image-size, sharp, ajv, send-webmention, etc.)
 *   - Loaded via createRequire inside the consuming module.
 *
 * **Express and friends**
 *   - CJS packages but generally ESM-safe in Node 24 via default interop.
 *   - Imported directly with ESM `import` syntax.
 */

// Wave 8 — genuine ESM leaf modules
import * as config from './lib/config.mjs'
import generateSearchFn from './lib/generate-search.mjs'
import {
  getPostType,
  getAvailablePostTypes,
  addPostType,
} from './lib/post-type-discovery.mjs'
// Wave 9 — converted ESM spine modules
import { use, plugins } from './lib/plugins.mjs'
import { default as micropubRouter } from './lib/router.mjs'
import { get as getCollection } from './lib/db.mjs'

// ===== Public API types =====

export interface PostrCore {
  use: (...args: unknown[]) => void
  plugins: Record<string, unknown>
  getCollection: () => Promise<unknown>
  router: unknown
  generateSearch: (text: string) => string
  addPostType: (options: {
    id: string
    name: string
    discovery: (post: any) => boolean
  }) => void
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
      getCollection,
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
