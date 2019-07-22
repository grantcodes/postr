const url = require('url')
const axios = require('axios')
const TelegramBot = require('node-telegram-bot-api')
const BaseSyndicator = require('@postr/syndicator')

const isTelegramUrl = telegramUrl => {
  const parsedUrl = url.parse(telegramUrl)
  return parsedUrl.hostname === 't.me'
}

class TelegramSyndicator extends BaseSyndicator {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'telegram',
        name: 'Telegram',
        default: true,
      },
      options
    )
    super({ options, imports })
    this.requireOptions(['token', 'channel'])
    this.getBot = this.getBot.bind(this)
  }

  getBot() {
    const bot = new TelegramBot(this.options.token)
    return bot
  }

  /**
   * Creates a telegram message from the mf2 object
   * @param {object} mf2 A mf2 post object
   * @param {string} permalink The permalink of the original mf2 post
   * @returns {object} A status object used to create a tweet
   */
  getMessage(mf2, permalink) {
    let content = ''

    if (mf2.properties['in-reply-to'] && mf2.properties['in-reply-to'][0]) {
      let replyTo = mf2.properties['in-reply-to'][0]
      content += `↩ Replied to ${replyTo}: ` + '\n\n'
    }

    if (mf2.properties.name) {
      content += `*${mf2.properties.name}*` + '\n\n'
    }

    if (mf2.properties.summary) {
      content += mf2.properties.summary[0] + ' ' + mf2.properties.url[0]
    } else if (
      mf2.properties.content &&
      mf2.properties.content[0] &&
      mf2.properties.content[0].value
    ) {
      if (mf2.properties.content[0].value.length > 400) {
        content +=
          mf2.properties.content[0].value.substr(0, 400) +
          '...\n\nRead more at ' +
          mf2.properties.url[0]
      } else {
        content += mf2.properties.content[0].value
      }
    }

    if (mf2.children && mf2.properties.url) {
      content += ' \n\nView the full collection at ' + mf2.properties.url[0]
    }

    return content
  }

  async syndicate(mf2) {
    try {
      const permalink = mf2.properties.url[0]
      const syndication = mf2.properties.syndication || []
      // If there is an existing syndication to telegram do not syndicate this post
      if (syndication.find(isTelegramUrl)) {
        // There is already a telegram syndication for this post. So lets skip it
        return null
      } else if (mf2.properties['like-of'] || mf2.properties['bookmark-of']) {
        // Don't post likes or bookmarks to telegram
        return null
      } else {
        // Do the post and return the url
        const bot = this.getBot()
        const message = this.getMessage(mf2, permalink)
        try {
          if (mf2.properties.featured) {
            for (let fileUrl of mf2.properties.featured) {
              if (typeof fileUrl !== 'string' && fileUrl.value) {
                fileUrl = fileUrl.value
              }
              const res = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
              })
              const buffer = Buffer.from(res.data)
              await bot.sendPhoto(this.options.channel, buffer)
            }
          }
          if (mf2.properties.audio) {
            for (const fileUrl of mf2.properties.audio) {
              const res = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
              })
              const buffer = Buffer.from(res.data)
              await bot.sendAudio(this.options.channel, buffer)
            }
          }
          if (mf2.properties.photo) {
            for (let fileUrl of mf2.properties.photo) {
              if (typeof fileUrl !== 'string' && fileUrl.value) {
                fileUrl = fileUrl.value
              }
              const res = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
              })
              const buffer = Buffer.from(res.data)
              await bot.sendPhoto(this.options.channel, buffer)
            }
          }
          if (mf2.properties.video) {
            for (const fileUrl of mf2.properties.video) {
              const res = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
              })
              const buffer = Buffer.from(res.data)
              await bot.sendVideo(this.options.channel, buffer)
            }
          }
          const res = await bot.sendMessage(this.options.channel, message, {
            parse_mode: 'Markdown',
          })
          let channelName = this.options.name
          if (channelName.startsWith('@')) {
            channelName = channelName.substr(1)
          }
          const telegramUrl = `https://t.me/${channelName}/${res.message_id}`
          return telegramUrl
        } catch (err) {
          console.error('[Error posting to telegram]', err)
          return null
        }
      }
    } catch (err) {
      console.error('[Error syndicating to telegram]', err)
    }
    return null
  }

  async deleteSyndication(mf2) {
    try {
      const messages = mf2.properties.syndication.filter(isTelegramUrl)
      if (!messages.length) {
        // No syndicated messages found
        return null
      }
      const bot = this.getBot()
      for (const message of messages) {
        const messageParts = message.split('/')
        const messageId = messageParts.pop() || messageParts.pop()
        const res = await bot.deleteMessage(this.options.channel, message)
        if (res) {
          return message
        }
      }
      return null
    } catch (err) {
      console.error('[Error deleting telegram syndication]', err)
      return null
    }
  }
}

module.exports = TelegramSyndicator
