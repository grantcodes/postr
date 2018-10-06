const RxDB = require('rxdb/plugins/core')
const fs = require('fs-extra')
const formatContent = require('./db-middleware/format-content')
const sendWebmentions = require('./db-middleware/webmentions')
const createRefs = require('./db-middleware/create-refs')
const saveFilesMiddleware = require('./db-middleware/save-files')
const validateMiddleware = require('./db-middleware/validate')
const setDefaultsMiddleware = require('./db-middleware/set-defaults')
const getFixPermalinkConflictMiddleware = require('./db-middleware/fix-permalink-conflicts')
const generateSearch = require('./generate-search')
const config = require('./config')
const getPermalink = require('./get-permalink-from-mf2')
const appendToFilename = require('./append-to-filename')
const placeholders = require('./placeholders')

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

// Store in leveldb by default
if (config.get('dbAdapter') == 'leveldown') {
  RxDB.plugin(require('pouchdb-adapter-leveldb'))
}

let Collection = {}

// Run everything async
async function init() {
  // Set up the database
  const db = await RxDB.create({
    name: config.get('dbName'),
    adapter: config.get('dbAdapter'),
    password: config.get('dbPassword'),
    multiInstance: false,
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
        indexDate: {
          type: 'integer',
          index: true,
        },
      },
      required: ['type', 'properties', 'indexDate'],
      // disableKeyCompression: true,
      // additionalProperties: true,
    },
    // Methods that can be run on any RxDocument in the database that do useful things
    methods: {
      /**
       * Gets the permalink for a document
       */
      getPermalink: function() {
        let post = this
        if (RxDB.isRxDocument(post)) {
          post = post._data
        }
        return getPermalink(post)
      },
      getReferences: function() {
        const doc = this
        let refs = {}
        const refsArray = doc.get('cms.references') || []
        refsArray.forEach(ref => {
          if (ref.properties.url) {
            ref.properties.url.forEach(url => {
              refs[url] = ref
            })
          }
        })
        return refs
      },
      getImageSizes: function() {
        const doc = this
        const post = doc._data
        let result = {}
        const sizes = config.get('imageSizes')
        if (sizes) {
          const imageProperties = ['photo', 'featured']
          imageProperties.forEach(key => {
            if (post.properties[key]) {
              post.properties[key].forEach(photo => {
                if (
                  typeof photo == 'string' &&
                  photo.indexOf('{{mediaBaseUrl}}') === 0
                ) {
                  // Ok this photo is stored here, so check if it has resized versions
                  const photoFileLoc =
                    config.get('mediaDir') +
                    photo.replace('{{mediaBaseUrl}}', '')
                  let photoObject = {}
                  for (const size in sizes) {
                    if (fs.existsSync(appendToFilename(size, photoFileLoc))) {
                      photoObject[size] = appendToFilename(size, photo)
                    } else {
                      photoObject[size] = photo
                    }
                  }
                  result[photo] = photoObject
                }
              })
            }
          })
        }
        return result
      },
      toMf2: function() {
        const doc = this
        let post = doc._data
        if (!post.cms) {
          post.cms = {}
        }
        post.references = doc.getReferences()
        post.cms.imageSizes = doc.getImageSizes()
        delete post.cms.references

        if (!post.properties.url) {
          post.properties.url = [doc.getPermalink()]
        }

        // Undo placeholders on children
        if (post.children) {
          post.children = post.children.map(child =>
            placeholders.replace(child)
          )
        }

        // Undo placeholders on media
        if (post.properties.photo) {
          post.properties.photo = post.properties.photo.map(media =>
            placeholders.replace(media)
          )
        }
        if (post.properties.video) {
          post.properties.video = post.properties.video.map(media =>
            placeholders.replace(media)
          )
        }
        if (post.properties.audio) {
          post.properties.audio = post.properties.audio.map(media =>
            placeholders.replace(media)
          )
        }

        Object.keys(post).forEach(key => {
          if (key.indexOf('_') === 0) {
            delete post[key]
          }
          if (key.indexOf('index') === 0) {
            delete post[key]
          }
        })

        return post
      },
    },
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
  // TODO: Only needs to run if the mp-slug property was updated
  db.posts.preSave(fixPermalinkConflictMiddleware, false)

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
    db.posts.postInsert(createRefs, false)
    db.posts.postSave(createRefs, false)
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
