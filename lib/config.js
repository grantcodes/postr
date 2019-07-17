const isNode = require('./is-node')

let configFile = __dirname + '/../config.json'

const defaults = {
  permalinkPattern: ':siteBaseUrl/:year/:month/:day/:slug',
  sendWebmentions: true,
  formatContent: true,
  getRefs: true,
  downloadExternalMedia: true,
  syndication: [],
  mediaDir: __dirname + '/../media',
  dbName: 'micropubendpoint',
  dbAdapter: 'default',
  imageSizes: {},
  micropubConfig: {},
}

// Allow setting of the config file location via environment variables
if (process.env && process.env.MICROPUB_ENDPOINT_CONFIG) {
  configFile = process.env.MICROPUB_ENDPOINT_CONFIG
}

// Allow setting of the config file location via a cli argument
if (isNode && process.argv) {
  const args = process.argv.slice(2)
  args.forEach(arg => {
    if (arg.indexOf('--config=') === 0) {
      configFile =
        process.cwd() +
        '/' +
        arg
          .replace('--config=', '')
          .replace("'", '')
          .replace('"', '')
    }
  })
}

let userConfig = {}
if (isNode && configFile) {
  // TODO: This breaks stuff!
  // userConfig = require(configFile)
}

let config = Object.assign({}, defaults, userConfig)
module.exports = {
  get: key => {
    const tmpConfig = Object.assign({}, config)
    if (tmpConfig.hasOwnProperty(key)) {
      return tmpConfig[key]
    }
    return null
  },
  set: (key, value) => {
    config[key] = value
  },
  required: requiredKeys => {
    for (const key of requiredKeys) {
      if (!config.hasOwnProperty(key)) {
        throw new Error('Missing required config property: ' + key)
      }
    }
  },
}
