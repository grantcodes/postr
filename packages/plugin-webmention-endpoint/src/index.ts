import {
  fetchEntry,
  FetchError,
  urlValues,
  type Mf2Item,
  type Post,
  type PostrPlugin,
} from '@postr/core'

export interface WebmentionEndpointOptions {
  /** Called with each new mention's h-entry, e.g. to send a notification. */
  notify?: (entry: Mf2Item, post: Post) => void | Promise<void>
}

/** Post properties received mentions are stored in, by the kind of response. */
export const mentionProperties = ['like', 'repost', 'bookmark', 'comment', 'mention'] as const

const origin = 'plugin:webmention'

function samePage(a: string, b: string) {
  const strip = (url: string) => {
    const parsed = URL.parse(url)
    return parsed ? parsed.host + parsed.pathname.replace(/\/$/, '') + parsed.search : url
  }
  return strip(a) === strip(b)
}

function mentionProperty(entry: Mf2Item, targets: string[]) {
  const respondsTo = (key: string) =>
    urlValues(entry.properties, key).some((url) => targets.some((t) => samePage(url, t)))
  if (respondsTo('like-of')) return 'like'
  if (respondsTo('repost-of')) return 'repost'
  if (respondsTo('bookmark-of')) return 'bookmark'
  if (respondsTo('in-reply-to')) return 'comment'
  return 'mention'
}

const isFromSource = (source: string) => (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  'properties' in value &&
  urlValues((value as Mf2Item).properties, 'url').includes(source)

/**
 * Receives webmentions at `<endpoint>/plugin/webmention` and stores the source's h-entry
 * on the target post as a `like`, `repost`, `bookmark`, `comment` or `mention`.
 */
export function webmentionEndpoint(options: WebmentionEndpointOptions = {}): PostrPlugin {
  return {
    id: 'webmention',
    name: 'Webmention Endpoint',
    routes(app, ctx) {
      const { posts } = ctx.postr

      async function removeMention(post: Post, source: string) {
        const remove: Record<string, Post['properties'][string]> = {}
        for (const property of mentionProperties) {
          const existing = post.properties[property]?.filter(isFromSource(source))
          if (existing?.length) remove[property] = existing
        }
        if (Object.keys(remove).length) await posts.update(post.id, { delete: remove }, { origin })
      }

      app.post('/', async (c) => {
        const body = await c.req.parseBody()
        const source = typeof body.source === 'string' ? body.source : ''
        const target = typeof body.target === 'string' ? body.target : ''
        // Webmention §3.2.1: only http(s) source and target URLs are valid.
        const isHttp = (url: string) => /^https?:$/.test(URL.parse(url)?.protocol ?? '')
        if (!isHttp(source) || !isHttp(target)) {
          return c.text('Missing or invalid source and target', 400)
        }
        if (samePage(source, target)) return c.text('Source and target are the same', 400)

        const post = await posts.getByUrl(target)
        // Drafts and private posts answer like missing ones, so their URLs stay hidden.
        if (!post || post.status !== 'published' || post.visibility === 'private') {
          return c.text('Target is not a post on this site', 400)
        }

        let entry: Mf2Item
        try {
          entry = await fetchEntry(source, ctx.fetch)
        } catch (err) {
          if (err instanceof FetchError && err.status === 410) {
            await removeMention(post, source)
            return c.text('Mention deleted', 200)
          }
          return c.text('Could not fetch the source', 400)
        }

        const targets = [target, post.url, ...urlValues(post.properties, 'syndication')]
        if (!targets.some((t) => JSON.stringify(entry).includes(t))) {
          await removeMention(post, source)
          return c.text('Source does not link to the target', 400)
        }

        entry.properties.url = [source]
        const property = mentionProperty(entry, targets)
        const existing = post.properties[property]?.find(isFromSource(source))
        await posts.update(
          post.id,
          existing
            ? { delete: { [property]: [existing] }, add: { [property]: [entry] } }
            : { add: { [property]: [entry] } },
          { origin }
        )
        if (!existing) await options.notify?.(entry, post)
        return c.text(existing ? 'Webmention update accepted' : 'Webmention accepted', 202)
      })
    },
  }
}
