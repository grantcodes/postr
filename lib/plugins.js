const RxDB = require('rxdb/plugins/core')
const { get: getCollection } = require('./db')
const generateSearch = require('./generate-search')
const config = require('./config')

const createSyndicatorRxDBPlugin = plugin => ({
  rxdb: true,
  hooks: {
    createRxCollection: collection => {
      collection.postSave(plugin.checkShouldSyndicateUpdate, false)
      collection.postInsert(plugin.checkShouldSyndicate, false)
    },
  },
})

const use = plugin => {
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
  } else {
    // This is probably an RxDB/Pouchdb plugin
    RxDB.plugin(plugin)
  }
}

module.exports = {
  use,
}
