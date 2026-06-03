const RxDB = require('rxdb/plugins/core')
const isNode = require('./is-node')
const validateMiddleware = require('./db-middleware/validate')
const setDefaultsMiddleware = require('./db-middleware/set-defaults')
const getFixPermalinkConflictMiddleware = require('./db-middleware/fix-permalink-conflicts')
const getPopulateChildrenMiddleware = require('./db-middleware/populate-children')
const staticMethods = require('./statics')
const schema = require('../schema/base')
const migrationStrategies = require('../schema/migration-strategies')
const config = require('./config')

const emptyMiddleware = () => {}

let saveFilesMiddleware = emptyMiddleware
let sendWebmentions = emptyMiddleware
let createRefs = emptyMiddleware
let formatContent = emptyMiddleware

if (isNode) {
  createRefs = require('./db-middleware/create-refs')
  saveFilesMiddleware = require('./db-middleware/save-files')
  sendWebmentions = require('./db-middleware/webmentions')
  formatContent = require('./db-middleware/format-content')
  // Store in leveldb by default
  if (config.get('dbAdapter') == 'default') {
    config.set('dbAdapter', 'leveldb')
    RxDB.plugin(require('pouchdb-adapter-leveldb'))
  }
} else if (config.get('dbAdapter') == 'default') {
  config.set('dbAdapter', 'idb')
  RxDB.plugin(require('pouchdb-adapter-idb'))
}

// Dont validate because we will use custom validation and load the majority of the default plugins
RxDB.plugin(require('rxdb/plugins/no-validate'))
RxDB.plugin(require('rxdb/plugins/error-messages'))
RxDB.plugin(require('rxdb/plugins/replication'))
RxDB.plugin(require('rxdb/plugins/in-memory'))
RxDB.plugin(require('rxdb/plugins/json-dump'))
RxDB.plugin(require('rxdb/plugins/key-compression'))
RxDB.plugin(require('rxdb/plugins/encryption'))
RxDB.plugin(require('rxdb/plugins/update'))
RxDB.plugin(require('rxdb/plugins/leader-election'))
RxDB.plugin(require('rxdb/plugins/adapter-check'))

let Collection = {}

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
  const fixPermalinkConflictMiddleware = getFixPermalinkConflictMiddleware(
    db.posts
  )
  db.posts.preInsert(fixPermalinkConflictMiddleware, false)
  // TODO: Needs fix permalink conflict again only if the mp-slug property was updated
  // db.posts.preSave(fixPermalinkConflictMiddleware, false)

  // Populate post children
  const popuplateChildrenMiddleware = getPopulateChildrenMiddleware(db.posts)
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

let initPromise = null
Collection.get = async () => {
  if (!initPromise) initPromise = init()
  return initPromise
}

module.exports = Collection
