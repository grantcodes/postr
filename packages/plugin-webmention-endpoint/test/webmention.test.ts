import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr, type Mf2Item } from '@postr/core'
import { webmentionEndpoint } from '../src/index.ts'

const pages = new Map<string, Response | (() => Response)>()
const fakeFetch = (async (input: string | URL | Request) => {
  const url = input instanceof Request ? input.url : String(input)
  const page = pages.get(url)
  const response = typeof page === 'function' ? page() : page?.clone()
  return response ?? new Response('', { status: 404 })
}) as typeof fetch

const html = (body: string) =>
  new Response(`<html><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } })

async function setup() {
  const notified: Mf2Item[] = []
  const postr = createPostr({
    siteUrl: 'https://example.com',
    endpointUrl: 'https://example.com/micropub',
    database: ':memory:',
    auth: { dangerousToken: 't' },
    runJobs: false,
    fetch: fakeFetch,
    plugins: [webmentionEndpoint({ notify: (entry) => void notified.push(entry) })],
  })
  const post = await postr.posts.create({
    type: ['h-entry'],
    properties: { name: ['Target'], published: ['2026-01-01T00:00:00Z'] },
  })
  const send = (source: string, target = post.url) =>
    postr.fetch(
      new Request('https://example.com/micropub/plugin/webmention', {
        method: 'POST',
        body: new URLSearchParams({ source, target }),
      }),
    )
  return { postr, post, send, notified }
}

describe('webmention endpoint', () => {
  it('stores likes and replies on the target post and notifies once', async () => {
    const { postr, post, send, notified } = await setup()
    pages.set('https://them.example/like', html(
      `<div class="h-entry"><a class="u-like-of" href="${post.url}">liked</a><p class="p-name">Liked it</p></div>`,
    ))
    pages.set('https://them.example/reply', html(
      `<div class="h-entry"><a class="u-in-reply-to" href="${post.url}">re</a><p class="e-content">Nice</p></div>`,
    ))

    assert.equal((await send('https://them.example/like')).status, 202)
    assert.equal((await send('https://them.example/reply')).status, 202)
    assert.equal((await send('https://them.example/reply')).status, 202)

    const stored = await postr.posts.get(post.id)
    assert.equal(stored?.properties.like?.length, 1)
    assert.equal(stored?.properties.comment?.length, 1)
    assert.equal(notified.length, 2)
  })

  it('rejects mentions that do not link to the target or target another site', async () => {
    const { send } = await setup()
    pages.set('https://them.example/unrelated', html('<div class="h-entry"><p class="p-name">Nothing</p><p class="e-content">here</p></div>'))
    assert.equal((await send('https://them.example/unrelated')).status, 400)
    assert.equal((await send('https://them.example/unrelated', 'https://other.example/post')).status, 400)
    assert.equal((await send('not a url')).status, 400)
  })

  it('removes a mention when the source returns 410 Gone', async () => {
    const { postr, post, send } = await setup()
    pages.set('https://them.example/gone', html(
      `<div class="h-entry"><p class="p-name">Mention</p><div class="e-content"><a href="${post.url}">you</a></div></div>`,
    ))
    await send('https://them.example/gone')
    assert.equal((await postr.posts.get(post.id))?.properties.mention?.length, 1)

    pages.set('https://them.example/gone', () => new Response('', { status: 410 }))
    assert.equal((await send('https://them.example/gone')).status, 200)
    assert.equal((await postr.posts.get(post.id))?.properties.mention, undefined)
  })
})
