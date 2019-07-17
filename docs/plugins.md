# Plugins

Postr is highly extensible via plugins.

## Syndication

There are a number of readymade syndication plugins.

### Twitter

```bash
npm install @postr/syndicator-twitter
```

```js
const Postr = require('@postr/core')
const TwitterSyndicator = require('@postr/syndicator-twitter')

const postr = new Postr(options)
postr.use(TwitterSyndicator, {
  handle: 'grantcodes',
  consumerKey: 'consumerkey',
  consumerSecret: 'consumersecret',
  accessToken: 'accesstoken',
  secretToken: 'secrettoken',
  default: true, // Syndicate to twitter even if no syndication is set
})
```

### Instagram

```bash
npm install @postr/syndicator-instagram
```

```js
const Postr = require('@postr/core')
const InstagramSyndicator = require('@postr/syndicator-instagram')

const postr = new Postr(options)
postr.use(InstagramSyndicator, {
  username: 'instagramusername',
  password: 'instagrampassword',
  default: true, // Syndicate to instagram even if no syndication is set
  blurBackground: false, // If true, adds a blurred background to resized images
})
```

### Superfeedr

```bash
npm install @postr/syndicator-superfeedr
```

```js
const Postr = require('@postr/core')
const SuperfeedrSyndicator = require('@postr/syndicator-superfeedr')

const postr = new Postr(options)
postr.use(SuperfeedrSyndicator, {
  hub: 'superfeedrhub',
  domain: 'superfeedrdomain',
  default: true, // Syndicate to Superfeedr even if no syndication is set
})
```

## Webmention Endpoint

```bash
npm install @postr/plugin-webmention-endpoint
```

```js
const Postr = require('@postr/core')
const WebmentionEndpoint = require('@postr/plugin-webmention-endpoint')

const postr = new Postr(options)
postr.use(WebmentionEndpoint, {
  notifier: function(notification) {
    // Handle sending notifications somehow.
    // The notification variable can be a simple string or a mf2 object
  }
})
```

## Developing a plugin

To develop a plugin you can extend a base plugin and hook into the RxDB database and express router.

```bash
npm install @postr/plugin
```

```js
const PostrPlugin = require('@postr/plugin')

class MyPlugin extends PostrPlugin {
  // Plugins must have a constuctor that sets at least an id and name and any other default options
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'my-plugin',
        name: 'My Postr Plugin',
      },
      options
    )
    super({ options, imports })

    // A bunch of dependencies from the postr instance are available via the imports object (also this.imports)
    const { RxDB, config, getCollection, generateSearch, router, getHEntry, isNode } = imports

    // Register a router to handle network requests
    this.router = this.router.bind(this)
    this.addRouter(this.router())

    // Custom hook into RxDB
    this.rxdb = this.rxdb.bind(this)
  }


  router() {
    const router = require('express').Router()

    router.get('/', (req, res, next) => {
      // Handle router request however you wish
    })

    return router
  }

  rxdb() {
    const { RxDB } = this.imports

    RxDB.plugin({
      rxdb: true,
      hooks: {
        createRxCollection: collection => {
          // Do something with the collection here
          // RxDB Plugin documentation is available here: https://rxdb.info/plugins.html
        },
      },
    })
  }
}

module.exports = MyPlugin
```

### Developing a syndication plugin

Since syndication plugins all follow a similar pattern they have a more structured base syndicator module that can be extended.

```bash
npm install @postr/syndicator
```

```js
const axios = require('axios')
const BaseSyndicator = require('@postr/syndicator')

class MySyndicator extends BaseSyndicator {
  // Constructor that sets at least an id, name and if the syndication should be considered default or not
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'my-syndicator',
        name: 'My Syndicator',
        default: true,
      },
      options
    )
    super({ options, imports })

    // If you require the user to input options (such as keys and usernames)
    // you can use the requireOptions method to throw an error if the option is missing
    this.requireOptions(['myServiceKey'])
  }

  async syndicate(mf2) {
    // Handle publishing the mf2 object however you want here.

    // Return the url of the syndicated copy to save it to the `syndication` property of the post
    // Return null if there is no url or you do not wish to save it for some reason
    return syndicatedUrl
  }

  async deleteSyndication(mf2) {
    // Handle deleting this syndicated post from the service
    // You will probably want to check the mf2.properties.syndication array for the url of the syndicated post on your service

    // Return the url of the syndicated post after deletion and it will be removed from the syndication property
    return syndicatedUrl
  }
}

module.exports = MySyndicator

```