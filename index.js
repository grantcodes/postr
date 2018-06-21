const Collection = require('./lib/db')
const micropubRouter = require('./lib/router')
const config = require('./lib/config')

// Run everything async
async function init() {
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
    console.log('Media folder url:', config.get('endpointBaseUrl') + '/static')
  })
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

if (require.main === module) {
  // Running directly, not in another application
  config.required(requiredOptions)
  init()
}

module.exports = function(options) {
  try {
    // When running as a module we definitely need a media base url
    requiredOptions.push('mediaBaseUrl')
    config.overrides(options)
    config.required(requiredOptions)
    return {
      getCollection: Collection.get,
      router: micropubRouter,
      micropubEndpoint: config.get('baseUrl') + '/',
      mediaEndpoint: config.get('baseUrl') + '/media',
    }
  } catch (err) {
    return new Error(err)
  }
}
