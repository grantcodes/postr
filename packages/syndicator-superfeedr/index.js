const axios = require('axios')
const BaseSyndicator = require('@postr/syndicator')

class SuperfeedrSyndicator extends BaseSyndicator {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'superfeedr',
        name: 'Superfeedr',
        default: true,
      },
      options
    )
    super({ options, imports })
    this.requireOptions(['hub', 'domain'])
  }

  async syndicate(mf2) {
    const { hub, domain } = this.options
    const permalink = mf2.properties.url[0]
    if (permalink && hub && domain) {
      let url = `${hub}?hub.mode=publish&hub.url=${domain}`
      // Do this after a timeout so we are sure it was created.
      setTimeout(async () => {
        await axios.post(url)
      }, 5000)
    }
    return null
  }
}

module.exports = SuperfeedrSyndicator
