const RxDB = require('rxdb/plugins/core')
const { get: getCollection } = require('./db')
const generateSearch = require('./generate-search')
const config = require('./config')
const isNode = require('./is-node')
const router = require('./router')
const getHEntry = require('./get-hentry')
const usedPlugins = {}

const use = (plugin, options = {}) => {
  if (typeof plugin === 'function' && /^\s*class\s+/.test(plugin.toString())) {
    const instance = new plugin({
      options,
      imports: {
        RxDB,
        config,
        getCollection,
        generateSearch,
        router,
        getHEntry,
        isNode,
      },
    })
    if (instance && instance.options && instance.options.id) {
      usedPlugins[instance.options.id] = instance
    }
  } else {
    // This is probably an RxDB/Pouchdb plugin
    RxDB.plugin(plugin)
  }
}

module.exports = {
  use,
  plugins: usedPlugins,
}
