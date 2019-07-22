const url = require('url')
const path = require('path')
const axios = require('axios')
const brevity = require('brevity')
const Twitter = require('twitter')
const BaseSyndicator = require('@postr/syndicator')

const tweetIdFromUrl = tweetUrl => {
  const parsedUrl = url.parse(tweetUrl)
  const statusId = path.basename(parsedUrl.pathname)
  return statusId
}

const isTweetUrl = tweetUrl => {
  const parsedUrl = url.parse(tweetUrl)
  return parsedUrl.hostname === 'twitter.com'
}

class TwitterSyndicator extends BaseSyndicator {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'twitter',
        name: 'Twitter',
        default: true,
      },
      options
    )
    super({ options, imports })
    this.requireOptions([
      'consumerKey',
      'consumerSecret',
      'accessToken',
      'secretToken',
      'handle',
    ])
  }

  /**
   * Sets up and returs the twitter client object
   * @returns {object} The twitter client object
   */
  async getClient() {
    const client = new Twitter({
      consumer_key: this.options.consumerKey,
      consumer_secret: this.options.consumerSecret,
      access_token_key: this.options.accessToken,
      access_token_secret: this.options.secretToken,
    })
    return client
  }

  /**
   * Posts a status to twitter
   * @param {object} status Twitter status object
   * @returns {string} A tweet url
   */
  async postStatus(status) {
    const client = await this.getClient()
    const { user, id_str } = await client.post('statuses/update', status)
    const tweetUrl = `https://twitter.com/${user.screen_name}/status/${id_str}`
    return tweetUrl
  }

  /**
   * Creates a twitter status object from the given parameters
   * @param {object} mf2 A mf2 post object
   * @param {string} permalink The permalink of the original mf2 post
   * @param {Array} media_ids An array of media ids to include as photos on a tweet
   * @returns {object} A status object used to create a tweet
   */
  generateStatus(mf2, permalink, media_ids = false) {
    let content = null
    if (mf2.properties.summary) {
      content = mf2.properties.summary[0] + ' ' + mf2.properties.url[0]
    } else if (mf2.properties.name) {
      content = mf2.properties.name[0]
    } else if (mf2.properties.summary) {
      content = mf2.properties.summary[0]
    } else if (
      mf2.properties.content &&
      mf2.properties.content[0] &&
      mf2.properties.content[0].value
    ) {
      content = mf2.properties.content[0].value
    } else if (mf2.properties['repost-of']) {
      content = mf2.properties['repost-of'][0]
    }

    if (mf2.children && mf2.properties.url) {
      content += ' View the full collection at ' + mf2.properties.url[0]
    }

    let status = {
      status: content,
    }

    // Add media.
    if (media_ids) {
      status.media_ids = media_ids.join(',')
    }

    // Add in reply to if appropriate
    if (mf2.properties['in-reply-to'] && mf2.properties['in-reply-to'][0]) {
      let replyTo = mf2.properties['in-reply-to'][0]
      if (replyTo.indexOf('twitter.com') > -1) {
        const parsedUrl = url.parse(replyTo)
        const statusId = tweetIdFromUrl(replyTo)
        status.in_reply_to_status_id = statusId
        const username = '@' + parsedUrl.pathname.split('/')[1]
        if (status.status && status.status.indexOf(username) === -1) {
          status.status = username + ' ' + status.status
        }
      }
    }

    // Add location
    if (mf2.properties.location) {
      let geouri = mf2.properties.location[0]
      if (typeof geouri == 'string') {
        if (geouri.indexOf(';u') > -1) {
          geouri = geouri.substring(0, geouri.indexOf(';'))
        }
        if (geouri.indexOf('geo:') === 0) {
          geouri = geouri.substr(4, geouri.length - 4)
        }
        const coords = geouri.split(',')
        status.lat = coords[0]
        status.long = coords[1]
      } else if (
        geouri.properties &&
        geouri.properties.latitude &&
        geouri.properties.longitude
      ) {
        status.lat = geouri.properties.latitude[0]
        status.long = geouri.properties.longitude[0]
      }
    }

    if (status.content) {
      status.content = brevity.shorten(
        status.content,
        permalink,
        false,
        false,
        280
      )
    } else {
      console.log('Error generating twitter status', status, mf2)
    }

    return status
  }

  /**
   * Uploads an image to twitter and returns the media id
   * @param {string|buffer} image A url of an image or a buffer
   * @returns {string} A twitter media id
   */
  async mediaUpload(image) {
    const client = await this.getClient()
    if (typeof image == 'string') {
      const res = await axios.get(image, { responseType: 'arraybuffer' })
      image = Buffer.from(res.data)
    }
    if (image instanceof Buffer) {
      const media = await client.post('media/upload', { media: image })
      return media.media_id_string
    }
    throw new Error('Error posting image')
  }

  /**
   * Post a mf2 object to twitter
   * @param {object} post A mf2 post object
   * @param {string} permalink The permalink of the post
   * @returns {string} The url of the created tweet
   */
  async post(post, permalink = null) {
    const client = await this.getClient()

    // If it is a repost then first check if it is a retweet
    if (
      post.properties['repost-of'] &&
      post.properties['repost-of'][0] &&
      isTweetUrl(post.properties['repost-of'][0])
    ) {
      const statusId = tweetIdFromUrl(post.properties['repost-of'][0])
      const { user, id_str } = await client.post(
        'statuses/retweet/' + statusId,
        {}
      )
      const repostUrl = `https://twitter.com/${
        user.screen_name
      }/status/${id_str}#favorited-by-${this.options.handle}`
      return repostUrl
    } else if (
      post.properties['like-of'] &&
      post.properties['like-of'][0] &&
      isTweetUrl(post.properties['like-of'][0])
    ) {
      // Check if it is a like of a tweet then sydicate the like
      const statusId = tweetIdFromUrl(post.properties['like-of'][0])
      const { user, id_str } = await client.post('favorites/create', {
        id: statusId,
      })
      const likeUrl = `https://twitter.com/${user.screen_name}/status/${id_str}`
      return likeUrl
    } else if (post.children) {
      // Handle collections
      let mediaIds = []
      let status = null
      let children = post.children
      if (children.length > 4) {
        children = children.slice(0, 4)
      }
      // TODO: Handle collections correctly
    } else {
      // Check for photos
      let mediaIds = []
      let status = null
      if (post.properties.photo) {
        // Trim to 4 photos as twitter doesn't support more
        let photos = post.properties.photo.slice(0, 4)
        for (let photo of photos) {
          if (photo.value) {
            photo = photo.value
          }
          if (photo.buffer) {
            photo = photo.buffer
          }
          mediaIds.push(await this.mediaUpload(photo))
        }
      }
      mediaIds = mediaIds.length ? mediaIds : false
      status = this.generateStatus(post, permalink, mediaIds)
      if (status) {
        return await this.postStatus(status)
      }
    }
    console.error('Unknown error posting to twitter')
    return false
  }

  async syndicate(mf2) {
    try {
      const permalink = mf2.properties.url[0]
      const syndication = mf2.properties.syndication || []
      // If there is an existing syndication to twitter do not syndicate this post
      if (syndication.find(tweet => isTweetUrl(tweet))) {
        // There is already a twitter syndication for this post. So lets skip it
        return null
      } else if (
        (mf2.properties['like-of'] &&
          !isTweetUrl(mf2.properties['like-of'][0])) ||
        (mf2.properties['in-reply-to'] &&
          !isTweetUrl(mf2.properties['in-reply-to'][0]))
      ) {
        // Don't post likes and replies of external urls
        return null
      } else {
        const tweetUrl = await this.post(mf2, permalink)
        return tweetUrl
      }
    } catch (err) {
      console.log('Error syndicating to twitter', err)
    }
    return null
  }

  async deleteSyndication(mf2) {
    try {
      const tweets = mf2.properties.syndication.filter(tweet =>
        isTweetUrl(tweet)
      )
      if (!tweets.length) {
        // No syndicated tweets found
        return null
      }
      const client = await this.getClient()
      for (const tweet of tweets) {
        if (
          mf2.properties['repost-of'] &&
          isTweetUrl(mf2.properties['repost-of'][0])
        ) {
          // Un retweet
          const statusId = tweetIdFromUrl(tweet)
          await client.post(`statuses/unretweet/${statusId}`, {})
        } else if (
          mf2.properties['like-of'] &&
          isTweetUrl(mf2.properties['like-of'][0])
        ) {
          // Un like
          const statusId = tweetIdFromUrl(mf2.properties['like-of'][0])
          await client.post('favorites/destroy', { id: statusId })
        } else {
          // Un post
          const statusId = tweetIdFromUrl(tweet)
          await client.post(`statuses/destroy/${statusId}`, {})
        }
      }
      return tweets[0]
    } catch (err) {
      console.log('Error deleting twitter syndication', err)
      return null
    }
  }
}

module.exports = TwitterSyndicator
