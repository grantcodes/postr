const RxDB = require('rxdb/plugins/core')
const Ajv = require('ajv')
const getSchema = require('../schema/postTypes')
const formatContent = require('./db-middleware/format-content')
const sendWebmentions = require('./db-middleware/webmentions')
const createRefs = require('./db-middleware/create-refs')
const saveFilesMiddleware = require('./db-middleware/save-files')
const generateSearch = require('./generate-search')
const config = require('./config')
const moment = require('moment')

// Dont validate because we will use custom validation and load the majority of the default plugins
RxDB.plugin(require('rxdb/plugins/no-validate'))
RxDB.plugin(require('rxdb/plugins/error-messages'))
RxDB.plugin(require('rxdb/plugins/replication'))
RxDB.plugin(require('rxdb/plugins/in-memory'))
RxDB.plugin(require('rxdb/plugins/json-dump'))
RxDB.plugin(require('rxdb/plugins/key-compression'))
RxDB.plugin(require('rxdb/plugins/encryption'))
RxDB.plugin(require('rxdb/plugins/update'))
RxDB.plugin(require('rxdb/plugins/leader-election')) // TODO: Not sure what this one does
RxDB.plugin(require('rxdb/plugins/adapter-check'))

// Store in sqlite by default
RxDB.plugin(require('pouchdb-adapter-node-websql'))
const ajv = new Ajv({ schemaId: 'auto', allErrors: true })
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'))

let Collection = {}

/**
 * Validate a mf2 doc against the correct schema
 * @param {object} doc
 */
const validateDoc = doc => {
  // Get the raw data first
  if (RxDB.isRxDocument(doc)) {
    doc = Object.assign({}, doc._data)
  } else {
    doc = Object.assign({}, doc)
  }

  // Remove database specific keys
  Object.keys(doc).forEach(key => {
    if (key.indexOf('_') === 0) {
      delete doc[key]
    }
  })

  const schema = getSchema(doc)
  if (!schema) {
    throw new Error('Missing schema: ' + JSON.stringify(doc.type))
  }
  const validate = ajv.compile(schema)
  const valid = validate(doc)
  if (valid) {
    // Still need to check unknown properties are arrays
    Object.values(doc.properties).forEach(property => {
      if (!Array.isArray(property)) {
        throw new Error(property + ' is not an array')
      }
    })
  }

  if (!valid) {
    console.log(
      'This document appears to be invalid',
      JSON.stringify(doc, null, 2)
    )
    throw new Error('Document is not valid mf2: ' + ajv.errorsText())
  }
}

const getPermalink = function(post) {
  const pattern = config.get('permalinkPattern')

  const date = moment(
    post.properties.published ? post.properties.published[0] : Date.now()
  )
  const year = date.format('YYYY')
  const month = date.format('MM')
  const day = date.format('DD')
  const slug = post.properties['mp-slug'][0]

  return pattern
    .replace(':siteBaseUrl', config.get('siteBaseUrl'))
    .replace(':year', year)
    .replace(':month', month)
    .replace(':day', day)
    .replace(':slug', slug)
}

// Run everything async
async function init() {
  // Set up the database
  const db = await RxDB.create({
    name: config.get('dbName'),
    adapter: config.get('dbAdapter'),
    password: config.get('dbPassword'),
    multiInstance: false, // TODO: need to decide what this should be
    // ignoreDuplicate: true,
  })

  // Create the posts collection using the mf2 schema
  await db.collection({
    name: 'posts',
    schema: {
      version: 0,
      id: 'post',
      type: 'object',
      properties: {
        type: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        properties: {
          type: 'object',
        },
      },
      required: ['type', 'properties'],
      // additionalProperties: true,
      // TODO: Add some sort of indexing
    },
    methods: {
      getPermalink: function() {
        let post = this
        if (RxDB.isRxDocument(post)) {
          post = post._data
        }
        return getPermalink(post)
      },
    },
  })

  db.posts.preInsert(validateDoc, false)
  db.posts.preSave(validateDoc, false)

  db.posts.preInsert(doc => {
    if (!doc.properties.published) {
      doc.properties.published = [new Date().toISOString()]
    }
    if (doc._id && !doc.properties['mp-slug']) {
      // TODO: generate shorter unique slugs, maybe even generate them from the text content...
      // TODO: Check if slug will cause conflict with any other post in the database
      doc.properties['mp-slug'] = [doc._id]
    }
    if (!doc.properties.visibility) {
      doc.properties.visibility = ['visible']
    }
    if (!doc.properties['post-status']) {
      doc.properties['post-status'] = ['published']
    }
    return doc
  }, false)

  db.posts.preSave(doc => {
    if (doc.get('_id') && !doc.get('properties.mp-slug')) {
      // TODO: generate better unique slugs
      doc.set('properties.mp-slug', [doc._id])
    }
    doc.set('properties.updated', [new Date().toISOString()])
    if (!doc.get('properties.visibility')) {
      doc.set('properties.visibility', ['visible'])
    }
    if (!doc.get('properties.post-status')) {
      doc.set('properties.post-status', 'published')
    }
    return doc
  })

  const fixPermalinkConficts = async doc => {
    if (!db || !db.posts) {
      return doc
    }
    let post = doc
    if (RxDB.isRxDocument(post)) {
      post = post._data
    }
    const permalink = getPermalink(post)
    const search = generateSearch(permalink)
    const originalSlug = post.properties['mp-slug'][0]
    let permalinkConflictIndex = 0
    while (await db.posts.findOne(search).exec()) {
      // Uh oh looks like we have a permalink confict
      permalinkConflictIndex++
      const newSlug = originalSlug + '-' + permalinkConflictIndex
      search['properties.mp-slug.0'] = newSlug
      post.properties['mp-slug'][0] = newSlug
    }
    return doc
  }
  db.posts.preInsert(fixPermalinkConficts, false)

  // Content formatting
  if (config.get('formatContent')) {
    db.posts.preInsert(formatContent, false)
    db.posts.preSave(formatContent, false)
  }

  // Download photos, audio and videos
  if (config.get('downloadExternalMedia')) {
    db.posts.postInsert(saveFilesMiddleware, false)
  }

  // Grab data from urls and create refs
  if (config.get('getRefs')) {
    db.posts.postInsert(createRefs, false)
    db.posts.postSave(createRefs, false)
  }

  // Webmentions
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
