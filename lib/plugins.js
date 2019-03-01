const RxDB = require('rxdb/plugins/core')
const { get: getCollection } = require('./db')
const generateSearch = require('./generate-search')
const config = require('./config')
const isNode = require('./is-node')
const router = require('./router')
const getHEntry = require('./get-hentry')

const createSyndicatorRxDBPlugin = plugin => ({
  rxdb: true,
  hooks: {
    createRxCollection: collection => {
      collection.postSave(plugin.checkShouldSyndicateUpdate, false)
      collection.postInsert(plugin.checkShouldSyndicate, false)
    },
  },
})

const use = (plugin, options = {}) => {
  if (plugin.isSyndicatorPlugin) {
    plugin.importCoreFunctionality({ getCollection, generateSearch })
    const syndicationTargets = [
      ...config.get('syndication'),
      {
        uid: plugin.options.id,
        name: plugin.options.name,
      },
    ]
    config.set('syndication', syndicationTargets)
    RxDB.plugin(createSyndicatorRxDBPlugin(plugin))
  } else if (
    typeof plugin === 'function' &&
    /^\s*class\s+/.test(plugin.toString())
  ) {
    new plugin({
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
  } else {
    // This is probably an RxDB/Pouchdb plugin
    RxDB.plugin(plugin)
  }
}

module.exports = {
  use,
}
