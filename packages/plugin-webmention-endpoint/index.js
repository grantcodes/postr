const PostrPlugin = require('@postr/plugin')

class WebmentionEndpoint extends PostrPlugin {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'webmention',
        name: 'Webmention Endpoint',
        notifier: () => {},
      },
      options
    )
    super({ options, imports })
    this.router = this.router.bind(this)
    this.deleteMention = this.deleteMention.bind(this)
    this.addRouter(this.router())
  }

  router() {
    const router = require('express').Router()
    const { notifier } = this.options
    const { getHEntry, config, generateSearch, getCollection } = this.imports
    const siteUrl = config.get('siteBaseUrl')

    router.post('/', async (req, res, next) => {
      if (!req.query || !req.query.source || !req.query.target) {
        notifier('Error with the webmention data')
        return res.status(400).send('Missing required webmention data')
      }

      const { source, target } = req.query
      const targetURL = new URL(target)
      const siteURL = new URL(siteUrl)

      if (targetURL.hostname !== siteURL.hostname) {
        // The target url is not on this site so ignore
        return res.status(400).send('Webmention is not for this url')
      }

      try {
        const sourceEntry = await getHEntry(source)

        // Add a url if it is missing
        if (!sourceEntry.properties.url) {
          sourceEntry.properties.url = [req.query.source]
        }

        // Send notification
        let notification = JSON.parse(JSON.stringify(sourceEntry))
        let notificationTitle = 'New Webmention Received'
        if (notification.properties && notification.properties.name) {
          notificationTitle =
            notificationTitle + ': ' + notification.properties.name[0]
        }
        notification.properties.name = [notificationTitle]
        notifier(notification)

        // Save the comment to the database
        if (
          targetURL.host + targetURL.pathname + targetURL.search ===
          siteURL.host + siteURL.pathname + siteURL.search
        ) {
          console.log('Homepage mention')
          // This is a homepage mention so should be handled differently
          // TODO: Do something with homepage mention
        } else {
          const search = generateSearch(target)
          const collection = await getCollection()
          const doc = await collection.findOne(search).exec()
          if (doc) {
            const post = doc.toMf2()
            let mentionProperty = 'webmention'
            const postUrls = [target, post.properties.url[0]]
            if (post.properties.syndication) {
              for (const syndicationUrl of post.properties.syndication) {
                postUrls.push(syndicationUrl)
              }
            }

            // Checks a property to see if it contains the post url (or syndicated url)
            const isReplyType = type => {
              if (sourceEntry.properties[type]) {
                const mentionValues = sourceEntry.properties[type]
                return mentionValues.some(mentionUrl => {
                  const mentionURL = new URL(mentionUrl)
                  return (
                    targetURL.host + targetURL.pathname + targetURL.search ===
                    mentionURL.host + mentionURL.pathname + mentionURL.search
                  )
                })
              }
              return false
            }

            // Determine if this is a like, repost, bookmark, or comment
            if (sourceEntry.properties) {
              if (isReplyType('like-of')) {
                mentionProperty = 'like'
              } else if (isReplyType('repost-of')) {
                mentionProperty = 'repost'
              } else if (isReplyType('bookmark-of')) {
                mentionProperty = 'bookmark'
              } else if (isReplyType('in-reply-to')) {
                mentionProperty = 'comment'
              }
            }

            let existingResponseIndex = -1
            if (post.properties[mentionProperty]) {
              existingResponseIndex = post.properties[
                mentionProperty
              ].findIndex(
                response => response.properties.url.indexOf(source) > -1
              )
            }

            if (existingResponseIndex > -1) {
              // Already have this saved, so it should update or delete the existing response
              doc.update({
                $set: {
                  [`properties.${mentionProperty}.${existingResponseIndex}`]: sourceEntry,
                },
              })
              return res.status(202).send('Webmention update accepted')
            } else {
              // New response so push it to an array
              doc.update({
                $push: { [`properties.${mentionProperty}`]: sourceEntry },
              })
              return res.status(202).send('Webmention accepted')
            }
          }
          return res
            .status(500)
            .send('There was an error saving your webmention')
        }
      } catch (err) {
        if (source && target && err && err.status && err.status === 410) {
          // Getting the source returned a 410 so should delete the mention
          const deleted = await this.deleteMention(source, target)
          if (deleted) {
            res.status(200).send('Deleted existing mention')
          }
        } else {
          console.log('Error saving webmention', err)
          return res
            .status(500)
            .send('There was an error saving your webmention')
        }
      }
    })

    return router
  }

  async deleteMention(source, target) {
    const { generateSearch, getCollection } = this.imports
    try {
      const search = generateSearch(target)
      const collection = await getCollection()
      const doc = await collection.findOne(search).exec()
      if (doc) {
        const mentionProperties = [
          'like',
          'repost',
          'boomkark',
          'comment',
          'mention',
        ]
        for (const property of mentionProperties) {
          let existing = doc.get(`properties.${property}`)
          if (existing) {
            const existingIndex = existing.findIndex(
              post =>
                post.properties &&
                post.properties.url &&
                post.properties.url[0] === source
            )
            if (existingIndex > -1) {
              // Found a thing to delete
              existing.splice(existingIndex, 1)
              if (existing.length > 0) {
                doc.update({
                  $set: { [`properties.${property}`]: existing },
                })
              } else {
                await doc.update({ $unset: { [`properties.${property}`]: '' } })
              }
            }
          }
        }
        return true
      }
    } catch (err) {
      console.log('Error deleting mention', err)
    }
    return false
  }
}

module.exports = WebmentionEndpoint
