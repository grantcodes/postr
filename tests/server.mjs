import { postr } from '../packages/core/dist/index.mjs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// express is a CJS dependency of @postr/core; resolve via its package context
const requireCore = createRequire(
  new URL('../packages/core/package.json', import.meta.url)
)
const express = requireCore('express')

// _data is local CJS; resolve via tests/ context
const requireLocal = createRequire(import.meta.url)
const mf2 = requireLocal('./_data')

const app = express()

const postrInstance = postr({
  permalinkPattern: ':siteBaseUrl/:year/:month/:day/:slug',
  sendWebmentions: false,
  formatContent: true,
  getRefs: true,
  downloadExternalMedia: true,
  mediaDir: __dirname + '/_tmp/media',
  dbName: 'tests/_tmp/postr',
  dbAdapter: 'leveldb',
  imageSizes: { thumbnail: [200, 200] },
  siteBaseUrl: 'http://localhost:3000',
  endpointBaseUrl: 'http://localhost:3000/micropub',
  mediaBaseUrl: 'http://localhost:3000/media',
  dbPassword: 'dbPassword',
  tokenEndpoint: 'https://tokens.indieauth.com/token',
  dangerousDevMode: true,
  dangerousPermanentToken: 'token',
})

// Insert sample data
postrInstance.getCollection().then((collection) =>
  collection
    .find()
    .limit(10)
    .exec()
    .then((docs) => {
      if (docs.length === 0) {
        console.log('Inserting example posts')
        collection.insert(mf2.note)
        collection.insert(mf2.article)
        collection.insert(mf2.photo)
      }
    })
)

app.use('/micropub', postrInstance.router)
app.listen(3000)

console.log('Postr test server listening at http://localhost:3000/micropub')
