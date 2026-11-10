import { basename } from 'node:path'
import type { Database } from './db/index.ts'
import { refs } from './db/schema.ts'
import type { JobQueue } from './jobs.ts'
import type { MediaStore } from './media.ts'
import type { Mf2Item, Mf2Value } from './mf2.ts'
import type { PluginContext, PostrPlugin, SaveEvent } from './plugins.ts'
import { getLinks, responseProperties } from './posts/links.ts'
import { fetchEntry } from './services/fetch-entry.ts'
import { sendWebmention } from './services/webmention.ts'

interface SideEffectOptions {
  db: Database
  jobs: JobQueue
  media?: MediaStore
  mediaUrl?: string
  plugins: PostrPlugin[]
  fetchReferences: boolean
  sendWebmentions: boolean
  downloadExternalMedia: boolean
  getContext: () => PluginContext
}

const isPublic = (event: SaveEvent['post']) =>
  !event.deletedAt && event.status === 'published' && event.visibility === 'public'

/**
 * Built-in behaviour expressed as a plugin: external media download before save,
 * then queued reference fetching, webmentions and syndication after save.
 * Only changes with the `user` origin trigger it, so its own writes cannot loop.
 */
export function createSideEffects(options: SideEffectOptions): PostrPlugin {
  const { jobs, db } = options
  const ctx = () => options.getContext()

  jobs.register('fetch-reference', async ({ url }: { url: string }) => {
    try {
      await ctx().postr.posts.saveReference(url, await fetchEntry(url, ctx().fetch))
    } catch (err) {
      const fetchedAt = new Date().toISOString()
      const error = err instanceof Error ? err.message : String(err)
      await db
        .insert(refs)
        .values({ url, fetchedAt, error })
        .onConflictDoUpdate({ target: refs.url, set: { fetchedAt, error } })
    }
  })

  jobs.register('webmention', async ({ source, target }: { source: string; target: string }) => {
    await sendWebmention(source, target, ctx().fetch)
  })

  jobs.register('syndicate', async ({ postId, target }: { postId: string; target: string }) => {
    const plugin = options.plugins.find((p) => p.id === target)
    const post = await ctx().postr.posts.get(postId)
    if (!plugin?.syndication || !post || !isPublic(post)) return
    const url = await plugin.syndication.syndicate(post, ctx())
    if (url) {
      await ctx().postr.posts.update(
        postId,
        { add: { syndication: [url] } },
        { origin: `syndication:${target}` }
      )
    }
  })

  async function downloadMedia(value: Mf2Value): Promise<Mf2Value> {
    const media = options.media
    const url =
      typeof value === 'string'
        ? value
        : value && typeof value === 'object'
          ? value.value
          : undefined
    if (!media || typeof url !== 'string' || !/^https?:/.test(url)) return value
    if (options.mediaUrl && url.startsWith(options.mediaUrl)) return value
    try {
      const response = await ctx().fetch(url)
      if (!response.ok) throw new Error(`status ${response.status}`)
      const saved = await media.save({
        data: new Uint8Array(await response.arrayBuffer()),
        name: basename(new URL(url).pathname),
        type: response.headers.get('content-type') ?? undefined,
      })
      return typeof value === 'string' ? saved : { ...(value as object), value: saved }
    } catch (err) {
      ctx().log.warn(`[postr] could not download ${url}: ${(err as Error).message}`)
      return value
    }
  }

  return {
    id: 'postr',
    async beforeSave(item: Mf2Item, { action }) {
      if (action !== 'create' || !options.downloadExternalMedia || !options.media) return item
      const properties = { ...item.properties }
      for (const key of ['photo', 'video', 'audio']) {
        const values = properties[key]
        if (values) properties[key] = await Promise.all(values.map(downloadMedia))
      }
      return { ...item, properties }
    },

    async afterSave(event) {
      if (event.origin !== 'user') return
      const { post, previous } = event
      const siteUrl = ctx().siteUrl
      const links = getLinks(post.properties, siteUrl)

      if (options.fetchReferences && (event.action === 'create' || event.action === 'update')) {
        const urls = new Set(
          links.filter((l) => responseProperties.includes(l.rel)).map((l) => l.url)
        )
        for (const url of urls) await jobs.enqueue('fetch-reference', { url })
      }

      const wasPublic = previous ? isPublic(previous) : false
      if (
        options.sendWebmentions &&
        post.visibility !== 'private' &&
        (isPublic(post) || wasPublic)
      ) {
        const targets = new Set(links.map((l) => l.url))
        if (previous) for (const l of getLinks(previous.properties, siteUrl)) targets.add(l.url)
        for (const target of targets) {
          await jobs.enqueue('webmention', { source: post.url, target })
        }
      }

      const requested = event.commands['mp-syndicate-to']
      // Publishing a draft counts as a create: its targets were dropped with the other mp-* commands.
      const firstPublish = event.action === 'create' || (event.action === 'update' && !wasPublic)
      const syndicate = isPublic(post) && (firstPublish || (event.action === 'update' && requested))
      if (syndicate) {
        for (const plugin of options.plugins) {
          if (!plugin.syndication) continue
          const wanted = requested
            ? requested.includes(plugin.id)
            : Boolean(plugin.syndication.default)
          if (wanted) await jobs.enqueue('syndicate', { postId: post.id, target: plugin.id })
        }
      }
    },
  }
}
