import { Feed, type Item } from 'feed'
import { firstString, htmlToText, type Context, type Post, type PostrPlugin } from '@postr/core'
import { mf2ToJf2 } from './jf2.ts'

export { mf2ToJf2, type Jf2 } from './jf2.ts'

export interface FeedsOptions {
  /** The site author, used for the feed and every item. */
  author: { name: string; photo?: string; url?: string; email?: string }
  /** Defaults to `<siteUrl> <format> feed`. */
  title?: string
  /** Posts per page. Default 50. */
  limit?: number
}

const formats = ['mf2json', 'jf2', 'rss', 'atom', 'json'] as const
type Format = (typeof formats)[number]

/** Serves mf2 JSON, JF2, RSS, Atom and JSON Feed at `<endpoint>/plugin/feeds/<format>`. */
export function feeds(options: FeedsOptions): PostrPlugin {
  const limit = options.limit ?? 50

  return {
    id: 'feeds',
    name: 'Feeds',
    routes(app, ctx) {
      const base = `${ctx.endpointUrl.replace(/\/$/, '')}/plugin/feeds`

      function toItem(post: Post): Item | null {
        const title = firstString(post.properties, 'name')
        const description = firstString(post.properties, 'summary')
        const contentValue = post.properties.content?.[0]
        let content =
          contentValue && typeof contentValue === 'object' && typeof contentValue.html === 'string'
            ? contentValue.html
            : firstString(post.properties, 'content')
        const image =
          firstString(post.properties, 'featured') ?? firstString(post.properties, 'photo')

        let itemTitle = title
        if (!title && !description) {
          if (!content) return null
          const text = htmlToText(content)
          itemTitle = text.length > 50 ? `${text.slice(0, 50)}…` : text
        }
        content ??= description ?? title

        const item: Item = {
          title: itemTitle ?? description ?? '',
          id: post.url,
          link: post.url,
          date: new Date(post.published),
          author: [
            {
              name: options.author.name,
              link: options.author.url ?? ctx.siteUrl,
              email: options.author.email,
            },
          ],
          category: (post.properties.category ?? [])
            .filter((c) => typeof c === 'string')
            .map((name) => ({ name })),
        }
        if (description) item.description = description
        if (content) item.content = content
        if (image) item.image = image
        return item
      }

      async function handle(c: Context) {
        const format = c.req.param('format') as Format
        if (!formats.includes(format)) return c.notFound()
        const page = Math.max(Number(c.req.param('page') ?? c.req.query('page')) || 1, 1)
        const posts = await ctx.postr.posts.list({
          limit,
          offset: (page - 1) * limit,
          postType: c.req.param('postType'),
          category: c.req.param('category'),
        })
        if (!posts.length) return c.json({ error: 'No posts found' }, 404)

        if (format === 'mf2json') return c.json({ items: posts.map(ctx.postr.posts.toMf2) })
        if (format === 'jf2') {
          return c.json({
            type: 'feed',
            url: c.req.url,
            name: options.title ?? `${ctx.siteUrl} JF2 Feed`,
            author: {
              type: 'card',
              name: options.author.name,
              photo: options.author.photo,
              url: options.author.url ?? ctx.siteUrl,
            },
            children: posts.map((post) => mf2ToJf2(ctx.postr.posts.toMf2(post))),
          })
        }

        const feed = new Feed({
          title: options.title ?? `${ctx.siteUrl} ${format} feed`,
          id: `${base}/${format}`,
          link: ctx.siteUrl,
          generator: '@postr/plugin-feeds',
          feedLinks: { rss: `${base}/rss`, atom: `${base}/atom`, json: `${base}/json` },
          author: {
            name: options.author.name,
            avatar: options.author.photo,
            link: options.author.url ?? ctx.siteUrl,
          },
          updated: new Date(posts[0]?.updated ?? Date.now()),
        })
        for (const post of posts) {
          const item = toItem(post)
          if (item) feed.addItem(item)
        }
        if (format === 'rss')
          return c.body(feed.rss2(), 200, { 'Content-Type': 'application/rss+xml; charset=utf-8' })
        if (format === 'atom')
          return c.body(feed.atom1(), 200, {
            'Content-Type': 'application/atom+xml; charset=utf-8',
          })
        return c.body(feed.json1(), 200, { 'Content-Type': 'application/feed+json; charset=utf-8' })
      }

      app.get('/:format', handle)
      app.get('/:format/page/:page', handle)
      app.get('/:format/type/:postType', handle)
      app.get('/:format/category/:category', handle)
    },
  }
}
