import { createRequire } from 'node:module'
import { get as getCollection } from './db.mjs'
import router from './router.mjs'
import generateSearch from './generate-search.mjs'
import * as config from './config.mjs'
import isNode from './is-node.mjs'
import getHEntry from './get-hentry.mjs'

const require = createRequire(import.meta.url)
const RxDB: any = require('rxdb/plugins/core')

const usedPlugins: Record<string, any> = {}

export function use(plugin: any, options: any = {}): void {
  if (
    typeof plugin === 'function' &&
    /^\s*class\s+/.test(plugin.toString())
  ) {
    const instance = new plugin({
      options,
      imports: {
        RxDB,
        config,
        getCollection,
        generateSearch,
        router,
        getHEntry,
        isNode,
      },
    })
    if (instance && instance.options && instance.options.id) {
      usedPlugins[instance.options.id] = instance
    }
  } else {
    // This is probably an RxDB/Pouchdb plugin
    RxDB.plugin(plugin)
  }
}

export { usedPlugins as plugins }
