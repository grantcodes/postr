import type { PostrPlugin } from '@postr/core'

export interface SuperfeedrOptions {
  /** WebSub hub, e.g. `https://example.superfeedr.com/`. */
  hub: string
  /** Topic URL(s) to ping: the feeds or pages that changed. */
  topic: string | string[]
  name?: string
  /** Ping when the client does not choose targets. Default `true`. */
  default?: boolean
}

/** Notifies a WebSub hub (Superfeedr or any other) after a post is published. */
export function superfeedr(options: SuperfeedrOptions): PostrPlugin {
  const topics = Array.isArray(options.topic) ? options.topic : [options.topic]
  return {
    id: 'superfeedr',
    name: options.name ?? 'Superfeedr',
    syndication: {
      default: options.default ?? true,
      async syndicate(_post, ctx) {
        const body = new URLSearchParams({ 'hub.mode': 'publish' })
        for (const topic of topics) body.append('hub.url', topic)
        const response = await ctx.fetch(options.hub, { method: 'POST', body })
        if (!response.ok) {
          throw new Error(`WebSub publish failed: ${response.status} ${response.statusText}`)
        }
        return null
      },
    },
  }
}
