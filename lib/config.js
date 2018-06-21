const nconf = require('nconf')

let configFile = __dirname + '/../config.json'

if (process.env && process.env.MICROPUB_ENDPOINT_CONFIG) {
  configFile = process.env.MICROPUB_ENDPOINT_CONFIG
}

if (process.argv) {
  const args = process.argv.slice(2)
  args.forEach(arg => {
    if (arg.indexOf('--config=') === 0) {
      configFile = arg
        .replace('--config=', '')
        .replace("'", '')
        .replace('"', '')
    }
  })
}

module.exports = nconf.file(configFile).defaults({
  permalinkPattern: '{{siteBaseUrl}}/{{year}}/{{month}}/{{day}}/{{slug}}',
  sendWebmentions: true,
  formatContent: true,
  getRefs: true,
  downloadExternalMedia: true,
  syndication: [],
  port: 80,
  mediaDir: __dirname + '/../media',
  dbName: 'micropubendpoint',
  dbAdapter: 'websql',
  imageSizes: {},
})
