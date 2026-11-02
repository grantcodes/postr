import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr } from '@postr/core'
import { telegram } from '../src/index.ts'

describe('telegram syndicator', () => {
  it('uploads photos, sends the message and stores the t.me URL', async () => {
    const calls: Array<{ method: string; fields: Record<string, string> }> = []
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://cdn.example.org/p.jpg') return new Response(new Uint8Array([1]))
      const method = url.split('/').pop() ?? ''
      const fields: Record<string, string> = {}
      for (const [key, value] of (init?.body as FormData).entries()) {
        fields[key] = typeof value === 'string' ? value : `file:${value.size}`
      }
      calls.push({ method, fields })
      return Response.json({ ok: true, result: { message_id: 42 } })
    }) as typeof fetch

    const postr = createPostr({
      siteUrl: 'https://example.com',
      endpointUrl: 'https://example.com/micropub',
      database: ':memory:',
      auth: { dangerousToken: 't' },
      runJobs: false,
      fetch: fakeFetch,
      downloadExternalMedia: false,
      fetchReferences: false,
      sendWebmentions: false,
      plugins: [telegram({ token: 'TOKEN', channel: '@mychannel' })],
    })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Hi <there>'], content: ['Body'], photo: ['https://cdn.example.org/p.jpg'] },
    })
    await postr.jobs.runDue()

    assert.deepEqual(calls.map((c) => c.method), ['sendPhoto', 'sendMessage'])
    assert.deepEqual(calls[0]?.fields, { chat_id: '@mychannel', photo: 'file:1' })
    assert.equal(calls[1]?.fields.text, '<b>Hi &lt;there&gt;</b>\n\nBody')
    assert.deepEqual((await postr.posts.get(post.id))?.properties.syndication, ['https://t.me/mychannel/42'])

    const like = await postr.posts.create({ type: ['h-entry'], properties: { 'like-of': ['https://x.example/'] } })
    await postr.jobs.runDue()
    assert.equal(calls.length, 2)
    assert.equal((await postr.posts.get(like.id))?.properties.syndication, undefined)
  })
})
