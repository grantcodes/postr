import { Hono } from 'hono'
import { openDatabase } from './db/index.ts'
import { createJobQueue } from './jobs.ts'
import { isMediaStore, localMediaStore, type MediaStore } from './media.ts'
import { createAuthenticator } from './micropub/auth.ts'
import { createMicropubApp } from './micropub/app.ts'
import type { PostrOptions } from './options.ts'
import type { PluginContext, PostrPlugin } from './plugins.ts'
import { builtInPostTypes } from './posts/post-type.ts'
import { createPostService } from './posts/service.ts'
import { createSideEffects } from './side-effects.ts'

/** Creates a postr instance: SQLite storage, typed post API, Micropub app and plugins. */
export function createPostr(options: PostrOptions) {
  for (const key of ['siteUrl', 'endpointUrl', 'auth'] as const) {
    if (!options[key]) throw new TypeError(`postr: missing required option "${key}"`)
  }
  const siteUrl = options.siteUrl.replace(/\/$/, '')
  const log = options.logger ?? console
  const fetchFn = options.fetch ?? fetch
  const readOnly = options.readOnly ?? false
  const db = openDatabase(options.database ?? 'postr.db', { readOnly })
  const jobs = createJobQueue(db, log, !readOnly && (options.runJobs ?? true))

  let media: MediaStore | undefined
  let mediaUrl: string | undefined
  if (options.media && isMediaStore(options.media)) media = options.media
  else if (options.media) {
    media = localMediaStore(options.media)
    mediaUrl = options.media.url
  }

  const userPlugins = options.plugins ?? []
  const ids = new Set<string>()
  for (const plugin of userPlugins) {
    if (ids.has(plugin.id) || plugin.id === 'postr') {
      throw new TypeError(`postr: duplicate plugin id "${plugin.id}"`)
    }
    ids.add(plugin.id)
  }

  const context = (): PluginContext => ({
    postr,
    siteUrl,
    endpointUrl: options.endpointUrl,
    log,
    fetch: fetchFn,
  })

  const plugins: PostrPlugin[] = [
    createSideEffects({
      db,
      jobs,
      media,
      mediaUrl,
      plugins: userPlugins,
      fetchReferences: options.fetchReferences ?? true,
      sendWebmentions: options.sendWebmentions ?? true,
      downloadExternalMedia: options.downloadExternalMedia ?? true,
      getContext: context,
    }),
    ...userPlugins,
  ]

  const postTypes = () => [
    ...plugins.flatMap((plugin) => plugin.postTypes ?? []),
    ...builtInPostTypes,
  ]

  const posts = createPostService({
    db,
    siteUrl,
    permalinkPattern: options.permalinkPattern ?? '/:year/:month/:day/:slug',
    formatContent: options.formatContent ?? true,
    readOnly,
    postTypes,
    async beforeSave(item, action, previous) {
      for (const plugin of plugins) {
        if (plugin.beforeSave)
          item = await plugin.beforeSave(item, { ...context(), action, previous })
      }
      return item
    },
    async afterSave(event) {
      for (const plugin of plugins) {
        try {
          await plugin.afterSave?.(event, context())
        } catch (err) {
          log.error(`[postr] plugin ${plugin.id} afterSave failed`, err)
        }
      }
    },
  })

  const app = createMicropubApp({
    posts,
    media,
    authenticate: createAuthenticator(options.auth, siteUrl, fetchFn),
    endpointUrl: options.endpointUrl,
    readOnly,
    postTypes,
    syndicateTo: () =>
      userPlugins.flatMap((plugin) =>
        plugin.syndication
          ? [
              {
                uid: plugin.id,
                name: plugin.syndication.name ?? plugin.name ?? plugin.id,
                ...(plugin.syndication.default ? { checked: true } : {}),
              },
            ]
          : []
      ),
    micropubConfig: options.micropubConfig ?? {},
  })

  const postr = {
    /** `siteUrl` without a trailing slash. */
    siteUrl,
    posts,
    media,
    /** Hono app serving Micropub at the `endpointUrl` path, plus plugin routes. */
    app,
    /** Fetch handler for Node servers, Next.js route handlers or Astro endpoints. */
    fetch: (request: Request) => app.fetch(request),
    jobs: { runDue: () => jobs.runDue(), idle: () => jobs.idle() },
    close() {
      jobs.stop()
      db.$client.close()
    },
  }

  for (const plugin of userPlugins) {
    plugin.setup?.(context())
    if (plugin.routes) {
      const routes = new Hono()
      plugin.routes(routes, context())
      app.route(`/plugin/${plugin.id}`, routes)
    }
  }
  jobs.start()

  return postr
}

export type Postr = ReturnType<typeof createPostr>
