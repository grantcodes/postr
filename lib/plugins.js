const RxDB = require('rxdb/plugins/core')
const { get: getCollection } = require('./db')
const generateSearch = require('./generate-search')

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
    RxDB.plugin(createSyndicatorRxDBPlugin(plugin))
  } else {
    // This is probably an RxDB/Pouchdb plugin
    RxDB.plugin(plugin)
  }
}

module.exports = {
  use,
}
