import { firstString, urlValues, type Post, type PostrPlugin } from '@postr/core'

export interface TelegramOptions {
  /** Bot token from @BotFather. */
  token: string
  /** Channel username (`@mychannel`) or chat id. */
  channel: string
  name?: string
  /** Syndicate when the client does not choose targets. Default `true`. */
  default?: boolean
  /** Bot API base URL, for tests or a local Bot API server. */
  apiUrl?: string
}

const isTelegramUrl = (url: string) => URL.parse(url)?.hostname === 't.me'

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Message text for a post, linking back to it when the content is cut short. */
export function telegramMessage(post: Post): string {
  const lines: string[] = []
  const replyTo = urlValues(post.properties, 'in-reply-to')[0]
  if (replyTo) lines.push(`↩ Replied to ${escapeHtml(replyTo)}:`)
  const name = firstString(post.properties, 'name')
  if (name) lines.push(`<b>${escapeHtml(name)}</b>`)

  const summary = firstString(post.properties, 'summary')
  const content = firstString(post.properties, 'content')
  if (summary) lines.push(`${escapeHtml(summary)} ${post.url}`)
  else if (content && content.length > 400) {
    lines.push(`${escapeHtml(content.slice(0, 400))}…\n\nRead more at ${post.url}`)
  } else if (content) lines.push(escapeHtml(content))

  if (post.children?.length) lines.push(`View the full collection at ${post.url}`)
  return lines.join('\n\n')
}

/** Posts to a Telegram channel, uploading photos, audio and video first. */
export function telegram(options: TelegramOptions): PostrPlugin {
  const api = `${options.apiUrl ?? 'https://api.telegram.org'}/bot${options.token}`

  return {
    id: 'telegram',
    name: options.name ?? 'Telegram',
    syndication: {
      default: options.default ?? true,
      async syndicate(post, ctx) {
        if (urlValues(post.properties, 'syndication').some(isTelegramUrl)) return null
        if (post.properties['like-of'] || post.properties['bookmark-of']) return null

        async function call(method: string, body: FormData) {
          const response = await ctx.fetch(`${api}/${method}`, { method: 'POST', body })
          const result = (await response.json()) as { ok: boolean; description?: string; result?: { message_id: number } }
          if (!result.ok) throw new Error(`Telegram ${method} failed: ${result.description}`)
          return result.result
        }

        const uploads = [
          ['featured', 'sendPhoto', 'photo'],
          ['photo', 'sendPhoto', 'photo'],
          ['audio', 'sendAudio', 'audio'],
          ['video', 'sendVideo', 'video'],
        ] as const
        for (const [property, method, field] of uploads) {
          for (const url of urlValues(post.properties, property)) {
            const response = await ctx.fetch(url)
            if (!response.ok) throw new Error(`Downloading ${url} failed with ${response.status}`)
            const form = new FormData()
            form.append('chat_id', options.channel)
            form.append(field, await response.blob(), URL.parse(url)?.pathname.split('/').pop() || field)
            await call(method, form)
          }
        }

        const form = new FormData()
        form.append('chat_id', options.channel)
        form.append('text', telegramMessage(post) || post.url)
        form.append('parse_mode', 'HTML')
        const message = await call('sendMessage', form)
        return message && `https://t.me/${options.channel.replace(/^@/, '')}/${message.message_id}`
      },
    },
  }
}
