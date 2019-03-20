const Collection = require('./lib/db')
const config = require('./lib/config')
const generateSearch = require('./lib/generate-search')
const { use, plugins } = require('./lib/plugins')
const micropubRouter = require('./lib/router')
const { addPostTypeDiscovery } = require('./lib/post-type-discovery')

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
      plugins,
      getCollection: Collection.get,
      router: micropubRouter,
      generateSearch,
      addPostTypeDiscovery,
      micropubEndpoint: config.get('baseUrl') + '/',
      mediaEndpoint:
        config.get('mediaEndpoint') || config.get('baseUrl') + '/media',
    }
  } catch (err) {
    console.log('Micropub setup err', err)
    return new Error(err)
  }
}
