import { createRequire } from 'node:module'
import * as config from './config.mjs'
import isNode from './is-node.mjs'
import * as staticMethods from './statics/index.mjs'
import schema from '../schema/base.mjs'
import migrationStrategies from '../schema/migration-strategies.mjs'

// DB middleware — imported statically; conditional assignment below
import validateMiddleware from './db-middleware/validate.mjs'
import setDefaultsMiddleware from './db-middleware/set-defaults.mjs'
import getFixPermalinkConflictMiddleware from './db-middleware/fix-permalink-conflicts.mjs'
import getPopulateChildrenMiddleware from './db-middleware/populate-children.mjs'
import createRefsMiddleware from './db-middleware/create-refs.mjs'
import saveFilesMiddlewareFn from './db-middleware/save-files.mjs'
import sendWebmentionsFn from './db-middleware/webmentions.mjs'
import formatContentMiddleware from './db-middleware/format-content.mjs'

const require = createRequire(import.meta.url)

// RxDB bootstrap — CJS-only deps
const RxDB: any = require('rxdb/plugins/core')
require('rxdb/plugins/no-validate')
require('rxdb/plugins/error-messages')
require('rxdb/plugins/replication')
require('rxdb/plugins/in-memory')
require('rxdb/plugins/json-dump')
require('rxdb/plugins/key-compression')
require('rxdb/plugins/encryption')
require('rxdb/plugins/update')
require('rxdb/plugins/leader-election')
require('rxdb/plugins/adapter-check')

// Pouch adapters — loaded conditionally
const pouchdbAdapterLeveldb = () => require('pouchdb-adapter-leveldb')
const pouchdbAdapterIdb = () => require('pouchdb-adapter-idb')

// Conditional middleware (Node-only)
const emptyMiddleware: any = () => {}

let saveFilesMiddleware = emptyMiddleware
let sendWebmentions = emptyMiddleware
let createRefs = emptyMiddleware
let formatContent = emptyMiddleware

if (isNode) {
  createRefs = createRefsMiddleware
  saveFilesMiddleware = saveFilesMiddlewareFn
  sendWebmentions = sendWebmentionsFn
  formatContent = formatContentMiddleware

  // Store in leveldb by default
  if (config.get('dbAdapter') === 'default') {
    config.set('dbAdapter', 'leveldb')
    RxDB.plugin(pouchdbAdapterLeveldb())
  }
} else if (config.get('dbAdapter') === 'default') {
  config.set('dbAdapter', 'idb')
  RxDB.plugin(pouchdbAdapterIdb())
}

// Run everything async
async function init() {
  // Set up the database
  const db = await RxDB.create({
    name: config.get('dbName'),
    adapter: config.get('dbAdapter'),
    password: config.get('dbPassword'),
    multiInstance: false,
    queryChangeDetection: true,
  })

  // Create the posts collection using the mf2 schema
  await db.collection({
    name: 'posts',
    schema,
    methods: staticMethods,
    migrationStrategies,
  })

  /**
   * Time to middleware all the things!!!
   */

  // First check posts are valid
  db.posts.preInsert(validateMiddleware, false)
  db.posts.preSave(validateMiddleware, false)

  // Set default properties
  db.posts.preInsert(setDefaultsMiddleware, false)
  db.posts.preSave(setDefaultsMiddleware, false)

  // Fix permalinks
  const fixPermalinkConflictMiddleware =
    getFixPermalinkConflictMiddleware(db.posts)
  db.posts.preInsert(fixPermalinkConflictMiddleware, false)
  // TODO: Needs fix permalink conflict again only if the mp-slug property was updated
  // db.posts.preSave(fixPermalinkConflictMiddleware, false)

  // Populate post children
  const popuplateChildrenMiddleware =
    getPopulateChildrenMiddleware(db.posts)
  db.posts.preInsert(popuplateChildrenMiddleware)
  db.posts.preSave(popuplateChildrenMiddleware)

  // Content formatting
  if (config.get('formatContent')) {
    db.posts.preInsert(formatContent, false)
    db.posts.preSave(formatContent, false)
  }

  // Download photos, audio and videos
  if (config.get('downloadExternalMedia')) {
    db.posts.preInsert(saveFilesMiddleware, false)
  }

  // Grab data from urls and create refs
  if (config.get('getRefs')) {
    db.posts.preInsert(createRefs, true)
    db.posts.preSave(createRefs, true)
  }

  // Send webmentions
  if (config.get('sendWebmentions')) {
    db.posts.postInsert(sendWebmentions, true)
    db.posts.postSave(sendWebmentions, true)
  }

  return db.posts
}

let initPromise: Promise<any> | null = null

export async function get(): Promise<any> {
  if (!initPromise) initPromise = init()
  return initPromise
}
