import { Syndicator as BaseSyndicator } from '@postr/syndicator'

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
        const res = await fetch(url, { method: 'POST' })
        if (!res.ok) throw new Error(
          `Superfeedr publish failed: ${res.status} ${res.statusText}`
        )
      }, 5000)
    }
    return null
  }
}

export { SuperfeedrSyndicator }
