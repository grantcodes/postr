import type { PluginContext, Post, PostrPlugin } from '@postr/core'

export interface WebhookTarget {
  url: string
  /** Extra request headers for this URL only, e.g. auth. */
  headers?: Record<string, string>
}

export interface WebhooksOptions {
  /** URL(s) to POST to when a post changes. */
  url: string | (string | WebhookTarget)[]
}

const timeoutMs = 5000

const isVisible = (post?: Post) =>
  Boolean(post && !post.deletedAt && post.status === 'published' && post.visibility !== 'private')

// Bulk writes (legacy import, `postr:*` maintenance such as media backfill) should not
// trigger one rebuild per post.
const isBulk = (origin: string) => origin === 'import' || origin.startsWith('postr:')

async function ping({ url, headers }: WebhookTarget, body: string, ctx: PluginContext) {
  try {
    const response = await ctx.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    await response.body?.cancel()
    if (!response.ok) throw new Error(`status ${response.status}`)
  } catch (err) {
    // Deploy-hook URLs embed their secret, so only the host is logged.
    ctx.log.warn(`[postr] webhook ${new URL(url).host} failed: ${(err as Error).message}`)
  }
}

/** POSTs `{ action, url, previousUrl? }` to each URL when a visible post changes. */
export function webhooks(options: WebhooksOptions): PostrPlugin {
  const targets = (Array.isArray(options.url) ? options.url : [options.url]).map((target) =>
    typeof target === 'string' ? { url: target } : target
  )
  return {
    id: 'webhooks',
    name: 'Webhooks',
    async afterSave({ action, post, previous, origin }, ctx) {
      if (isBulk(origin) || (!isVisible(post) && !isVisible(previous))) return
      const body = JSON.stringify({
        action,
        url: post.url,
        ...(previous && previous.url !== post.url ? { previousUrl: previous.url } : {}),
      })
      await Promise.all(targets.map((target) => ping(target, body, ctx)))
    },
  }
}
