const isNode = require('./lib/is-node')
const Collection = require('./lib/db')
const config = require('./lib/config')
const generateSearch = require('./lib/generate-search')
const { use } = require('./lib/plugins')
let micropubRouter = null
let init = async () => {}

if (isNode) {
  micropubRouter = require('./lib/router')
  init = async () => {
    const collection = await Collection.get()
    const express = require('express')
    const app = express()
    app.use('/', micropubRouter)
    if (!config.get('mediaBaseUrl')) {
      config.set('mediaBaseUrl', config.get('endpointBaseUrl') + '/static')
      app.static('/static', config.get('mediaDir'))
    }
    app.listen(config.get('port'), () => {
      console.log(`Running in standalone mode on port ${config.get('port')}`)
      console.log('Micropub Endpoint:', config.get('endpointBaseUrl') + '/')
      console.log('Media Endpoint:', config.get('endpointBaseUrl') + '/media')
      console.log(
        'Media folder url:',
        config.get('endpointBaseUrl') + '/static'
      )
    })
  }
}

const requiredOptions = [
  'port',
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

if (isNode && require && require.main === module) {
  // Running directly, not in another application
  config.required(requiredOptions)
  init()
}

module.exports = (options = {}) => {
  try {
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        const value = options[key]
        config.set(key, value)
      }
    }
    config.required(requiredOptions)
    return {
      use,
      getCollection: Collection.get,
      router: micropubRouter,
      generateSearch,
      micropubEndpoint: config.get('baseUrl') + '/',
      mediaEndpoint:
        config.get('mediaEndpoint') || config.get('baseUrl') + '/media',
    }
  } catch (err) {
    console.log('Micropub setup err', err)
    return new Error(err)
  }
}
