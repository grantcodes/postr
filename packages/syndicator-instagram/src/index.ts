import sharp, { type Sharp } from 'sharp'
import {
  firstString,
  urlValues,
  type PluginContext,
  type Post,
  type PostrPlugin,
} from '@postr/core'

export interface InstagramPhoto {
  file: Buffer
  width: number
  height: number
}

/** The Instagram operations the syndicator needs; the default uses `instagram-private-api`. */
export interface InstagramClient {
  /** Publishes one photo or an album, returning the post's shortcode. */
  publish(photos: InstagramPhoto[], caption: string): Promise<string>
  like(mediaId: string): Promise<void>
}

export interface InstagramOptions {
  username: string
  password: string
  proxy?: string
  /** Pad photos that do not fit Instagram's aspect ratios with a blurred copy instead of a flat colour. */
  blurBackground?: boolean
  name?: string
  /** Syndicate when the client does not choose targets. Default `true`. */
  default?: boolean
  /** Replaces the `instagram-private-api` login, e.g. for tests. */
  client?: () => Promise<InstagramClient>
}

const shortcodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const isInstagramUrl = (url: string) =>
  ['instagram.com', 'www.instagram.com'].includes(URL.parse(url)?.hostname ?? '')

/** Media id for an `instagram.com/p/<shortcode>/` URL. */
export function instagramUrlToId(url: string): string {
  const shortcode = (URL.parse(url)?.pathname ?? '').split('/').filter(Boolean).pop() ?? ''
  let id = 0n
  for (const char of shortcode) id = id * 64n + BigInt(shortcodeAlphabet.indexOf(char))
  return id.toString()
}

async function privateApiClient(options: InstagramOptions): Promise<InstagramClient> {
  const { IgApiClient } = (await import('instagram-private-api')).default
  const ig = new IgApiClient()
  if (options.proxy) ig.state.proxyUrl = options.proxy
  ig.state.generateDevice(options.username)
  await ig.simulate.preLoginFlow()
  await ig.account.login(options.username, options.password)
  void ig.simulate.postLoginFlow().catch(() => {})
  return {
    async publish(photos, caption) {
      const [first] = photos
      if (photos.length === 1 && first) {
        return (await ig.publish.photo({ file: first.file, caption })).media.code
      }
      const result = await ig.publish.album({ caption, items: photos })
      return result.media.code
    },
    async like(mediaId) {
      await ig.media.like({
        mediaId,
        moduleInfo: {
          module_name: 'profile',
          username: options.username,
          user_id: ig.state.cookieUserId,
        },
        d: 1,
      })
    },
  }
}

async function fitPhoto(data: Buffer, single: boolean, blur: boolean): Promise<InstagramPhoto> {
  const { width, height } = await sharp(data).metadata()
  const ratio = width / height
  let image: Sharp
  if (single && ratio >= 0.8 && ratio <= 1.91) {
    image = sharp(data).resize({ width: 2000, withoutEnlargement: true })
  } else if (blur) {
    const main = await sharp(data).resize({ width: 2000, height: 2000, fit: 'inside' }).toBuffer()
    image = sharp(data)
      .resize({ width: 2000, height: 2000 })
      .blur(300)
      .composite([{ input: main }])
  } else {
    image = sharp(data).resize({ width: 2000, height: 2000, fit: 'contain', background: '#fafafa' })
  }
  const { data: file, info } = await image.jpeg().toBuffer({ resolveWithObject: true })
  return { file, width: info.width, height: info.height }
}

/** Publishes photo posts (up to 10 photos) and likes of Instagram posts. */
export function instagram(options: InstagramOptions): PostrPlugin {
  const getClient = options.client ?? (() => privateApiClient(options))
  const alreadySyndicated = (post: Post) =>
    urlValues(post.properties, 'syndication').some(isInstagramUrl)

  async function publishPhotos(post: Post, ctx: PluginContext, client: InstagramClient) {
    const urls = urlValues(post.properties, 'photo')
    const caption = [
      firstString(post.properties, 'name') ??
        firstString(post.properties, 'summary') ??
        firstString(post.properties, 'content') ??
        '',
      urls.length > 10
        ? `the rest of this gallery is available at ${post.url}`
        : `Originally posted to ${post.url}`,
    ]
      .filter(Boolean)
      .join(' • ')

    const photos: InstagramPhoto[] = []
    for (const url of urls.slice(0, 10)) {
      const response = await ctx.fetch(url)
      if (!response.ok) throw new Error(`Downloading ${url} failed with ${response.status}`)
      const data = Buffer.from(await response.arrayBuffer())
      photos.push(await fitPhoto(data, urls.length === 1, Boolean(options.blurBackground)))
    }
    return `https://www.instagram.com/p/${await client.publish(photos, caption)}/`
  }

  return {
    id: 'instagram',
    name: options.name ?? 'Instagram',
    syndication: {
      default: options.default ?? true,
      async syndicate(post, ctx) {
        if (alreadySyndicated(post)) return null
        const likeOf = urlValues(post.properties, 'like-of')[0]

        if (post.children?.length) {
          const client = await getClient()
          for (const childUrl of post.children) {
            const child = await ctx.postr.posts.getByUrl(childUrl)
            if (!child || alreadySyndicated(child) || !child.properties.photo) continue
            const url = await publishPhotos(child, ctx, client)
            await ctx.postr.posts.update(
              child.id,
              { add: { syndication: [url] } },
              { origin: 'syndication:instagram' }
            )
          }
          return null
        }
        if (likeOf && isInstagramUrl(likeOf)) {
          await (await getClient()).like(instagramUrlToId(likeOf))
          return `${likeOf}#likedby-${options.username}`
        }
        if (post.properties.photo && !likeOf && !post.properties['in-reply-to']) {
          return publishPhotos(post, ctx, await getClient())
        }
        return null
      },
    },
  }
}
