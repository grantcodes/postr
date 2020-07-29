const { join } = require('path')

module.exports = {
  siteBaseUrl: 'http://localhost:3000',
  endpointBaseUrl: 'http://localhost:3000/micropub',
  // 'permalinkPattern': '',
  // 'syndication': '',
  mediaDir: join(__dirname, '.database'),
  mediaBaseUrl: 'http://localhost:3000/media',
  // 'dbAdapter': '',
  // 'dbName': '',
  dbPassword: 'testpassword',
  tokenEndpoint: 'https://tokens.indieauth.com',
}
