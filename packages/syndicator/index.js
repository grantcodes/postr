const PostrPlugin = require('@postr/plugin')

class Syndicator extends PostrPlugin {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        default: false,
      },
      options
    )
    super({ options, imports })

    this.setup = this.setup.bind(this)
    this.checkShouldSyndicate = this.checkShouldSyndicate.bind(this)
    this.checkShouldSyndicateUpdate = this.checkShouldSyndicateUpdate.bind(this)
    this.deleteSyndication = this.deleteSyndication.bind(this)
    this.syndicate = this.syndicate.bind(this)

    this.requireOptions(['id', 'name'])
    this.setup()
  }

  setup() {
    const { config, RxDB } = this.imports
    const syndicationTargets = [
      ...config.get('syndication'),
      {
        uid: this.options.id,
        name: this.options.name,
        checked: this.options.default,
      },
    ]
    config.set('syndication', syndicationTargets)
    RxDB.plugin({
      rxdb: true,
      hooks: {
        createRxCollection: (collection) => {
          collection.postSave(this.checkShouldSyndicateUpdate, true)
          collection.postInsert(this.checkShouldSyndicate, true)
        },
      },
    })
  }

  /**
   * Checks if the document should be syndicated and run the syndication
   * @param {RxDocument} doc The database document
   * @return {RxDocument} The updated database document
   */
  async checkShouldSyndicate(post, doc) {
    if (!doc) {
      doc = post
    }
    let shouldSyndicate = false
    if (
      doc.get('properties.visibility.0') === 'visible' &&
      doc.get('properties.post-status.0') === 'published'
    ) {
      // Post is visible and published so it maybe should be syndicated, lets check the mp-syndicate-to property
      const syndicateTo = doc.get('properties.mp-syndicate-to')
      if (!syndicateTo && this.options.default) {
        shouldSyndicate = true
      } else if (syndicateTo.includes(this.options.id)) {
        shouldSyndicate = true
      }
    }
    if (shouldSyndicate) {
      try {
        const url = await this.syndicate(doc.toMf2())
        if (url) {
          const syndication = doc.get('properties.syndication') || []
          syndication.push(url)
          await doc.update({ $set: { 'properties.syndication': syndication } })
        }
      } catch (err) {
        console.log(`Error syndicating with ${this.options.name}`, err)
      }
    }
    return doc
  }

  /**
   * Checks if the document has updated in some way that should trigger deletion or posting of a syndicated copy
   * @param {RxDocument} doc The database document to check
   * @return {RxDocument} The updated database document
   */
  async checkShouldSyndicateUpdate(post, doc) {
    if (!doc) {
      doc = post
    }
    if (
      doc.get('properties.syndication') &&
      (doc.get('properties.post-status.0') !== 'published' ||
        doc.get('properties.visibility.0') !== 'visible')
    ) {
      // Probably want to delete
      // TODO: This is not true, it will try and delete as soon as it is saved
      // const deletedUrl = await this.deleteSyndication(doc.toMf2())
      // if (deletedUrl) {
      //   await doc.update({
      //     $pullAll: { 'properties.syndication': [deletedUrl] },
      //   })
      //   const newSyndication = doc.get('properties.syndication')
      //   if (Array.isArray(newSyndication) && newSyndication.length === 0) {
      //     await doc.update({ $unset: { 'properties.syndication': '' } })
      //   }
      // }
    } else if (!post.syndication) {
      doc = await this.checkShouldSyndicate(doc)
    }
    return doc
  }

  async deleteSyndication(mf2) {
    // NOTE: Plugin should delete the syndication url in the syndication property and return the url of the deleted syndication
    return null
  }

  async syndicate(mf2) {
    // NOTE: Any plugin should provide their own async syndication methods and should check if they have not already syndicated this post
    return null
  }
}

module.exports = Syndicator
