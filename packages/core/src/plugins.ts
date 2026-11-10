import type { Hono } from 'hono'
import type { Mf2Item, Mf2Properties } from './mf2.ts'
import type { Logger } from './options.ts'
import type { PostTypeDefinition } from './posts/post-type.ts'
import type { Post } from './posts/service.ts'
import type { Postr } from './postr.ts'

export type SaveAction = 'create' | 'update' | 'delete' | 'undelete'

export interface SaveEvent {
  action: SaveAction
  post: Post
  previous?: Post
  /** Who made the change: `user` for Micropub/API calls, otherwise e.g. `plugin:<id>`. */
  origin: string
  /** Micropub `mp-*` commands sent with the change, e.g. `mp-syndicate-to`. Never stored. */
  commands: Mf2Properties
}

export interface PluginContext {
  postr: Postr
  siteUrl: string
  endpointUrl: string
  log: Logger
  fetch: typeof fetch
}

export interface BeforeSaveContext extends PluginContext {
  action: 'create' | 'update'
  previous?: Post
}

export interface SyndicationTarget {
  /** Display name in `q=config`; defaults to the plugin name. */
  name?: string
  /** Syndicate when the client sends no `mp-syndicate-to`. */
  default?: boolean
  /** Publishes a copy and returns its URL, or nothing to skip. */
  syndicate(post: Post, ctx: PluginContext): Promise<string | null | undefined>
}

export interface PostrPlugin {
  id: string
  name?: string
  /** Extra post types for `q=config` and discovery. */
  postTypes?: PostTypeDefinition[]
  /** Makes the plugin a Micropub `syndicate-to` target. */
  syndication?: SyndicationTarget
  setup?(ctx: PluginContext): void
  /**
   * Transforms a post before it is stored. Must not write anything itself.
   * Runs in plugin order for creates and updates.
   */
  beforeSave?(item: Mf2Item, ctx: BeforeSaveContext): Mf2Item | Promise<Mf2Item>
  /**
   * Reacts to a committed change. Writes back through `ctx.postr.posts` with an
   * `origin`, and should ignore events from its own origin. Awaited in plugin order.
   */
  afterSave?(event: SaveEvent, ctx: PluginContext): void | Promise<void>
  /** Adds routes, mounted at `<endpoint>/plugin/<id>`. */
  routes?(app: Hono, ctx: PluginContext): void
}
