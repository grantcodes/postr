const PostrPlugin = require('@postr/plugin')
const { Feed } = require('feed')
const mf2ToJf2 = require('./mf2tojf2')

class FeedPlugin extends PostrPlugin {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'feeds',
        name: 'Feeds for Postr',
      },
      options
    )
    super({ options, imports })
    this.createBaseFeed = this.createBaseFeed.bind(this)
    this.docToFeedItem = this.docToFeedItem.bind(this)
    this.mf2json = this.mf2json.bind(this)
    this.jf2 = this.jf2.bind(this)
    this.json = this.json.bind(this)
    this.rss = this.rss.bind(this)
    this.atom = this.atom.bind(this)
    this.getDocs = this.getDocs.bind(this)
    this.router = this.router.bind(this)
    this.addRouter(this.router())
    this.requireOptions(['hCard'])
  }

  /**
   * Gets the express router for the plugin
   */
  router() {
    const router = require('express').Router()

    router.get('/mf2json', this.mf2json)
    router.get('/mf2json/page/:page', this.mf2json)
    router.get('/mf2json/:postType', this.mf2json)
    router.get('/mf2json/:postType/page/:page', this.mf2json)

    router.get('/jf2', this.jf2)
    router.get('/jf2/category/:category', this.jf2)
    router.get('/jf2/type/:postType', this.jf2)
    router.get('/rss', this.rss)
    router.get('/rss/category/:category', this.rss)
    router.get('/rss/type/:postType', this.rss)
    router.get('/atom', this.atom)
    router.get('/atom/category/:category', this.atom)
    router.get('/atom/type/:postType', this.atom)
    router.get('/json', this.json)
    router.get('/json/category/:category', this.json)
    router.get('/json/type/:postType', this.json)

    return router
  }

  /**
   * Gets a set of documents from postr
   */
  async getDocs(req) {
    const limit = 50
    let skip = 0
    const { getCollection, generateSearch } = this.imports
    const { page, postType, category } = req.params
    const collection = await getCollection()
    let search = {}

    if (page) {
      skip = (page - 1) * limit
    }

    if (postType) {
      search['cms.postType'] = postType
    }

    if (category) {
      search['properties.category'] = {
        $in: [category],
      }
    }

    search = generateSearch(search)
    const docs = await collection
      .find(search)
      .limit(limit)
      .skip(skip)
      .sort({ indexDate: 'desc' })
      .exec()
    return docs
  }

  /**
   * Creates a feed object with the feed module
   */
  createBaseFeed(feedOptions, type) {
    const { config } = this.imports
    const { hCard } = this.options
    const defaults = {
      title: config.get('siteBaseUrl') + ` ${type} feed`,
      id: config.get('endpointBaseUrl') + `/plugin/feeds/${type}`, // TODO: need to add extra path
      link: config.get('siteBaseUrl'),
      generator: '@postr/plugin-feeds', // optional, default = 'Feed for Node.js'
      feedLinks: {
        jf2: config.get('endpointBaseUrl') + `/plugin/feeds/jf2`,
        rss: config.get('endpointBaseUrl') + `/plugin/feeds/rss`,
        json: config.get('endpointBaseUrl') + `/plugin/feeds/json`,
        atom: config.get('endpointBaseUrl') + `/plugin/feeds/atom`,
      },
      author: {
        name: hCard.properties.name[0],
        photo: hCard.properties.photo[0],
        link: hCard.properties.url
          ? hCard.properties.url[0]
          : config.get('siteBaseUrl'),
      },
    }
    feedOptions = Object.assign({}, defaults, feedOptions)
    const feed = new Feed(feedOptions)
    return feed
  }

  /**
   * Converts a postr document to a item for the the feed module
   */
  docToFeedItem(doc) {
    const { config } = this.imports
    const { hCard } = this.options

    const item = {
      title: doc.get('properties.name.0'),
      id: doc.getPermalink(),
      link: doc.getPermalink(),
      description: doc.get('properties.summary.0'),
      content: doc.get('properties.content.0.html'),
      author: [
        {
          name:
            doc.get('properties.author.0.properties.name.0') ||
            hCard.properties.name[0],
          link:
            doc.get('properties.author.0.properties.photo.0') ||
            hCard.properties.url
              ? hCard.properties.url[0]
              : config.get('siteBaseUrl'),
          email:
            doc.get('properties.author.0.properties.email.0') ||
            hCard.properties.name[0],
        },
      ],
      date: new Date(doc.get('properties.published.0')),
      image:
        doc.get('properties.featured.0') || doc.get('properties.photo.0.value'),
    }

    // Tidy up item removing undefined keys
    Object.keys(item).forEach((key) => {
      if (item[key] === undefined) {
        delete item[key]
      }
    })

    // Set title fallback from content
    if (!item.title && !item.description) {
      if (!item.content) {
        // This is a post type without a summary, name or content
        // TODO: Handle contentless posts like likes and reposts better.
        console.warn(
          '[Postr Feeds]',
          'Item is currently not supported',
          doc.toMf2()
        )
        return null
      } else {
        item.title =
          doc.get('properties.content.0.value').substring(0, 50) + '…'
      }
      console.log('No title or description for rss', item)
    }

    // Set content fallback from title
    if (!item.content && (item.description || item.title)) {
      item.content = item.description || item.title
    }

    return item
  }

  /**
   * Get mf2 json feed
   */
  async mf2json(req, res, next) {
    const docs = await this.getDocs(req)
    if (!docs || !docs.length) {
      return res.status(404).json({ error: 'No posts found' })
    }

    return res.json({
      items: docs.map((doc) => {
        const post = doc.toMf2()
        delete post.cms
        return post
      }),
    })
  }

  /**
   * Get jf2 feed
   */
  async jf2(req, res, next) {
    const { config } = this.imports
    const { hCard } = this.options
    const docs = await this.getDocs(req)
    if (!docs || !docs.length) {
      return res.status(404).json({ error: 'No posts found' })
    }

    const items = docs.map((doc) => {
      const post = doc.toMf2()
      delete post.cms
      return mf2ToJf2(post)
    })

    return res.json({
      type: 'feed',
      url: req.url,
      name: config.get('siteBaseUrl') + ` JF2 Feed`,
      author: {
        type: 'card',
        name: hCard.properties.name[0],
        photo: hCard.properties.photo[0],
        url: hCard.properties.url
          ? hCard.properties.url[0]
          : config.get('siteBaseUrl'),
      },
      children: items,
    })
  }

  /**
   * Get json feed
   */
  async json(req, res, next) {
    const docs = await this.getDocs(req)
    if (!docs || !docs.length) {
      return res.status(404).json({ error: 'No posts found' })
    }

    const feed = this.createBaseFeed({}, 'json')

    for (const doc of docs) {
      const item = this.docToFeedItem(doc)
      if (item) {
        feed.addItem(item)
      }
    }

    return res.type('json').send(feed.json1())
  }

  /**
   * Get rss feed
   */
  async rss(req, res, next) {
    const docs = await this.getDocs(req)
    if (!docs || !docs.length) {
      return res.status(404).json({ error: 'No posts found' })
    }

    const feed = this.createBaseFeed({}, 'rss')

    for (const doc of docs) {
      const item = this.docToFeedItem(doc)
      if (item) {
        feed.addItem(item)
      }
    }

    return res.type('rss').send(feed.rss2())
  }

  /**
   * Get atom feed
   */
  async atom(req, res, next) {
    const docs = await this.getDocs(req)
    if (!docs || !docs.length) {
      return res.status(404).json({ error: 'No posts found' })
    }

    const feed = this.createBaseFeed({}, 'atom')

    for (const doc of docs) {
      const item = this.docToFeedItem(doc)
      if (item) {
        feed.addItem(item)
      }
    }

    return res.type('atom').send(feed.atom1())
  }
}

module.exports = FeedPlugin
