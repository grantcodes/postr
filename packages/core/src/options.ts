import type { AuthOptions } from './micropub/auth.ts'
import type { MediaStore, LocalMediaOptions } from './media.ts'
import type { PostrPlugin } from './plugins.ts'

export type Logger = Pick<Console, 'info' | 'warn' | 'error'>

export interface PostrOptions {
  /** Site root, e.g. `https://example.com`. Post URLs are `siteUrl + path`. */
  siteUrl: string
  /** Public URL the Micropub app is served at; its pathname becomes the app's base path. */
  endpointUrl: string
  /** SQLite file path. Defaults to `postr.db`; use `:memory:` for tests. */
  database?: string
  /** Defaults to `/:year/:month/:day/:slug`. */
  permalinkPattern?: string
  auth: AuthOptions
  /** Where uploaded and downloaded media is stored. Without it, uploads are rejected. */
  media?: MediaStore | LocalMediaOptions
  plugins?: PostrPlugin[]
  /** Convert plain/markdown content to `{ html, value }` and collect `#hashtags`. Default `true`. */
  formatContent?: boolean
  /** Fetch and cache h-entry snapshots of referenced URLs. Default `true`. */
  fetchReferences?: boolean
  /** Send webmentions to linked URLs. Default `true`. */
  sendWebmentions?: boolean
  /** Copy external `photo`/`video`/`audio` URLs into the media store on create. Default `true`. */
  downloadExternalMedia?: boolean
  /** Extra values merged into the Micropub `q=config` response. */
  micropubConfig?: Record<string, unknown>
  /**
   * Open an already migrated database read-only: no migrations, no jobs, and every write
   * (posts API, Micropub POST, media upload) fails with `forbidden`. Default `false`.
   */
  readOnly?: boolean
  /** Run queued jobs automatically. Default `true`; tests call `postr.jobs.runDue()` instead. */
  runJobs?: boolean
  logger?: Logger
  /** Injected for outgoing requests (references, webmentions, media downloads). */
  fetch?: typeof fetch
}
