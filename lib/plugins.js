const RxDB = require('rxdb/plugins/core')

const createSyndicatorRxDBPlugin = plugin => ({
  rxdb: true,
  hooks: {
    createRxCollection: collection => {
      console.log('Plugin creating rx collection', plugin)
      collection.postSave(plugin.checkShouldSyndicate, false)
      collection.postInsert(plugin.checkShouldSyndicateUpdate, false)
      collection.postRemove(plugin.checkShouldDelete, false)
    },
  },
})

const use = plugin => {
  if (plugin.isSyndicatorPlugin) {
    RxDB.plugin(createSyndicatorRxDBPlugin(plugin))
  } else {
    // This is probably an RxDB plugin
    RxDB.plugin(plugin)
  }
}

module.exports = {
  use,
}
