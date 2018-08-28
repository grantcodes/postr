class Syndicator {
  constructor(options) {
    options = Object.assign(
      {
        default: false,
      },
      options
    )
    this.isSyndicatorPlugin = true
    this.options = options
    this.requireOptions = this.requireOptions.bind(this)
    this.checkShouldSyndicate = this.checkShouldSyndicate.bind(this)
    this.checkShouldDelete = this.checkShouldDelete.bind(this)
    this.checkShouldSyndicateUpdate = this.checkShouldSyndicateUpdate.bind(this)
    this.deleteSyndication = this.deleteSyndication.bind(this)
    this.syndicate = this.syndicate.bind(this)

    this.requireOptions(['id', 'name'])
  }

  requireOptions(keys) {
    keys.forEach(key => {
      if (!this.options.hasOwnProperty(key)) {
        throw new Error(`Missing the ${key} option`)
      }
    })
  }

  /**
   * Checks if the document should be syndicated and run the syndication
   * @param {RxDocument} doc The database document
   * @return {RxDocument} The updated database document
   */
  async checkShouldSyndicate(doc) {
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
          doc.set('properties.syndication', syndication)
        }
      } catch (err) {
        console.log(`Error syndicating with ${this.options.name}`, err)
      }
    }
    return doc
  }

  /**
   * Checks if the syndication should be deleted
   * @param {RxDocument} doc The database document to delete
   * @return {RxDocument} The same database document
   */
  async checkShouldDelete(doc) {
    // TODO: Should check if visibility or post-status changed too
    await this.deleteSyndication(doc.toMf2())
    return doc
  }

  /**
   * Checks if the document has updated in some way that should trigger deletion or posting of a syndicated copy
   * @param {RxDocument} doc The database document to check
   * @return {RxDocument} The updated database document
   */
  async checkShouldSyndicateUpdate(doc) {
    // TODO: This should check if the visibility changed to visible or post-status changed to published
    doc = await this.checkShouldSyndicate(doc)
    // TODO: This should also check for the reverse and delete any existing syndications
    return doc
  }

  deleteSyndication(mf2) {
    // NOTE: Plugin should delete the syndication url in the syndication property
  }

  async syndicate(mf2) {
    // NOTE: Any plugin should provide their own async syndication methods and should check if they have not already syndicated this post
  }
}

module.exports = Syndicator
