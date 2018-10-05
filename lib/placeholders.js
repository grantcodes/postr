const config = require('./config')

const keys = ['mediaBaseUrl', 'siteBaseUrl']

const add = url => {
  for (const key of keys) {
    if (url) {
      url = url.replace(config.get(key), `{{${key}}}`)
    }
  }
  return url
}

const replace = url => {
  for (const key of keys) {
    if (url) {
      url = url.replace(`{{${key}}}`, config.get(key))
    }
  }
  return url
}

module.exports = {
  add,
  replace,
}
