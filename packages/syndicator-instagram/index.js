const BaseSyndicator = require('@postr/syndicator')
const url = require('url')
const sharp = require('sharp')
const sizeOf = require('image-size')
const Clients = require('instagram-private-api')
const Client = Clients.V1

const isInstagramUrl = instaUrl => {
  const parsedUrl = url.parse(instaUrl)
  return (
    parsedUrl.hostname === 'instagram.com' ||
    parsedUrl.hostname === 'www.instagram.com'
  )
}

class InstagramSyndicator extends BaseSyndicator {
  constructor({ options, imports }) {
    options = Object.assign(
      {
        id: 'instagram',
        name: 'Instagram',
        default: true,
      },
      options
    )
    super({ options, imports })
    this.getSession = this.getSession.bind(this)
    this.requireOptions(['username', 'password'])
  }

  async getSession() {
    const device = new Client.Device(this.options.username)
    const storage = new Client.CookieFileStorage(__dirname + '/instagram.json')
    return await Client.Session.create(
      device,
      storage,
      this.options.username,
      this.options.password
    )
  }

  async postInstagramPhotos(mf2) {
    const session = await this.getSession()
    const permalink = mf2.properties.url[0]
    const collection = await this.imports.getCollection()
    const search = this.imports.generateSearch(permalink, true)
    const doc = await collection.findOne(search).exec()

    // Get buffers from mf2 photos

    let photoBuffers = []
    for (const photo of mf2.properties.photo) {
      photoBuffers.push(await doc.getFileBuffer(photo))
    }

    // Generate caption
    let caption = ''
    if (mf2.properties.name) {
      caption = mf2.properties.name[0]
    } else if (mf2.properties.summary) {
      caption = mf2.properties.summary[0]
    } else if (
      mf2.properties.content &&
      mf2.properties.content[0] &&
      mf2.properties.content[0].value
    ) {
      caption = mf2.properties.content[0].value
    }
    if (permalink && photoBuffers.length > 10) {
      caption += ` • the rest of this gallery is available at ${permalink}`
    } else if (permalink) {
      caption += ` • Originally posted to ${permalink}`
    }

    // Instagram supports a max of 10 photos
    if (photoBuffers.length > 10) {
      photoBuffers = photoBuffers.slice(0, 10)
    }

    // Resize photos to fit on instagram
    const resizedPhotos = []
    for (const photo of photoBuffers) {
      const size = sizeOf(photo)
      const aspectRatio = size.width / size.height
      if (aspectRatio < 0.8 || aspectRatio > 1.91 || photoBuffers.length > 1) {
        if (this.options.blurBackground) {
          const mainImage = await sharp(photo)
            .resize({
              width: 2000,
              height: 2000,
              fit: 'inside',
            })
            .toFormat('jpeg')
            .toBuffer()
          const backgroundImage = sharp(photo)
            .resize({ width: 2000, height: 2000 })
            .blur(300)
          const imageBuffer = await backgroundImage
            .overlayWith(mainImage)
            .toFormat('jpeg')
            .toBuffer()
          resizedPhotos.push(imageBuffer)
        } else {
          const imageBuffer = await sharp(photo)
            .resize({
              width: 2000,
              height: 2000,
              fit: 'contain',
              background: '#fafafa',
            })
            .toFormat('jpeg')
            .toBuffer()
          resizedPhotos.push(imageBuffer)
        }
      } else {
        const imageBuffer = await sharp(photo)
          .resize({ width: 2000 })
          .toFormat('jpeg')
          .toBuffer()
        resizedPhotos.push(imageBuffer)
      }
    }

    if (resizedPhotos.length === 1) {
      // Post single photo
      const upload = await Client.Upload.photo(session, resizedPhotos[0])
      const medium = await Client.Media.configurePhoto(
        session,
        upload.params.uploadId,
        caption
      )
      return medium.params.webLink
    } else {
      // Post multi-photo as album
      const photoMedias = []
      for (const photo of photos) {
        const size = sizeOf(photo)
        photoMedias.push({
          type: 'photo',
          size: [size.width, size.height],
          data: photo,
        })
      }

      const payload = await Client.Upload.album(session, photoMedias)
      await Client.Media.configureAlbum(session, payload, caption, false)
      const account = await session.getAccount()
      const myFeed = new Client.Feed.UserMedia(session, account.id, 1)
      const medias = await myFeed.get()
      const url = medias[0].params.webLink
      return url
    }
  }

  async syndicate(mf2) {
    try {
      // If there is an existing syndication to instagram do not syndicate this post
      if (
        mf2.properties.syndication &&
        mf2.properties.syndication.find(syndicationUrl =>
          isInstagramUrl(syndicationUrl)
        )
      ) {
        // There is already a instagram syndication for this post. So lets skip it
        return null
      } else {
        const session = await this.getSession()

        if (mf2.children) {
          const collection = await this.imports.getCollection()
          // Get child docs in an array
          const docs = []
          for (const permalink of mf2.children) {
            const search = this.imports.generateSearch(permalink, true)
            const doc = await collection.findOne(search).exec()
            if (doc) {
              docs.push(doc)
            }
          }

          // Then publish every post
          docs.forEach((doc, index) => {
            // If there is more that 60 posts we will hit a timout issue, so wait for just over an hour
            const timeout = Math.floor((index + 1) / 60) * 1000 * 60 * 70
            setTimeout(async () => {
              const childMf2 = doc.toMf2()
              // Check that this child has not already been syndicated to instagram
              if (
                !childMf2.properties.syndication ||
                !childMf2.properties.syndication.find(syndicationUrl =>
                  isInstagramUrl(syndicationUrl)
                )
              ) {
                const instaUrl = await this.postInstagramPhotos(childMf2)
                if (instaUrl) {
                  if (childMf2.properties.syndication) {
                    // Push syndication url
                    await doc.update({
                      $push: { 'properties.syndication': instaUrl },
                    })
                  } else {
                    // Add syndication array
                    await doc.update({
                      $set: { 'properties.syndication': [instaUrl] },
                    })
                  }
                }
              }
            }, timeout)
          })
          // Return null because the actual collection post isn't syndicated, only the child posts
          return null
        } else if (
          mf2.properties['like-of'] &&
          isInstagramUrl(mf2.properties['like-of'][0])
        ) {
          // Is instagram like.
          const media = await Client.Media.getByUrl(
            session,
            mf2.properties['like-of'][0]
          )
          await Client.Like.create(session, media.id)
          return (
            mf2.properties['like-of'][0] + '#likedby-' + this.options.username
          )
        } else if (
          mf2.properties.photo &&
          !mf2.properties['like-of'] &&
          !mf2.properties['in-reply-to']
        ) {
          // Is regular photo post
          const instaUrl = await this.postInstagramPhotos(mf2)
          return instaUrl
        }
      }
    } catch (err) {
      console.log('Error syndicating to instagram', err)
      return null
    }
  }

  async deleteSyndication(mf2) {
    try {
      const session = await this.getSession()
      const instaSyndicationUrl = mf2.properties.syndication
        ? mf2.properties.syndication.find(syndicationUrl =>
            isInstagramUrl(syndicationUrl)
          )
        : null
      if (instaSyndicationUrl) {
        // Has been syndicated to insta
        if (
          mf2.properties['like-of'] &&
          isInstagramUrl(mf2.properties['like-of'][0])
        ) {
          // Is like
          const media = await Client.Media.getByUrl(
            session,
            mf2.properties['like-of'][0]
          )
          await Client.Like.destroy(session, media.id)
          return instaSyndicationUrl
        } else {
          // Probably is regular post
          const media = await Client.Media.getByUrl(
            session,
            instaSyndicationUrl
          )
          await Client.Media.delete(session, media.id)
          return instaSyndicationUrl
        }
      } else if (mf2.children) {
        // Children may have been syndicated
        // Get child docs in an array
        const docs = []
        for (const permalink of mf2.children) {
          const search = this.imports.generateSearch(permalink, true)
          const doc = await collection.findOne(search).exec()
          if (doc) {
            docs.push(doc)
          }
        }

        // Then publish every post
        docs.forEach(async doc => {
          const childMf2 = doc.toMf2()
          // Check that this child has already been syndicated to instagram
          const childInstaUrl = childMf2.properties.syndication
            ? childMf2.properties.syndication.find(syndicationUrl =>
                isInstagramUrl(syndicationUrl)
              )
            : null

          if (childInstaUrl) {
            // Has a insta url so lets delete it
            const media = await Client.Media.getByUrl(session, childInstaUrl)
            await Client.Media.delete(session, media.id)
            await doc.update({
              $pullAll: { 'properties.syndication': [childInstaUrl] },
            })
            const newSyndication = doc.get('properties.syndication')
            if (Array.isArray(newSyndication) && newSyndication.length === 0) {
              await doc.update({ $unset: { 'properties.syndication': '' } })
            }
          }
        })
        // This is collection so no syndication to remove
        return null
      }
    } catch (err) {
      console.log('Error deleting instagram syndication', err)
    }
    return null
  }
}

module.exports = InstagramSyndicator
