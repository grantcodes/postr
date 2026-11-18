import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr } from '@postr/core'
import { webhooks } from '../src/index.ts'

function setup(respond: () => Response | Promise<Response> = () => new Response(null)) {
  const requests: { url: string; headers: Headers; body: any }[] = []
  const warnings: unknown[] = []
  const fakeFetch = (async (input: string | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(init?.body as string),
    })
    return respond()
  }) as typeof fetch
  const postr = createPostr({
    siteUrl: 'https://example.com',
    endpointUrl: 'https://example.com/micropub',
    database: ':memory:',
    auth: { dangerousToken: 't' },
    runJobs: false,
    logger: { info() {}, warn: (...args) => void warnings.push(args), error() {} },
    fetch: fakeFetch,
    fetchReferences: false,
    sendWebmentions: false,
    plugins: [
      webhooks({
        url: [
          'https://deploy.example/hook/secret',
          { url: 'https://site.example/rebuild', headers: { Authorization: 'Bearer secret' } },
        ],
      }),
    ],
  })
  return { postr, requests, warnings }
}

const note = (properties: Record<string, string[]> = {}) => ({
  type: ['h-entry'],
  properties: { content: ['hi'], 'mp-slug': ['hi'], ...properties },
})

describe('webhooks plugin', () => {
  it('posts the change to every URL, with headers only where configured', async () => {
    const { postr, requests } = setup()
    const post = await postr.posts.create(note())
    assert.deepEqual(
      requests.map((r) => r.url),
      ['https://deploy.example/hook/secret', 'https://site.example/rebuild']
    )
    for (const request of requests) {
      assert.deepEqual(request.body, { action: 'create', url: post.url })
      assert.equal(request.headers.get('content-type'), 'application/json')
    }
    assert.deepEqual(
      requests.map((r) => r.headers.get('authorization')),
      [null, 'Bearer secret']
    )
  })

  it('skips bulk imports and maintenance writes but not plugin writes', async () => {
    const { postr, requests } = setup()
    const post = await postr.posts.create(note(), { origin: 'import' })
    await postr.posts.update(
      post.id,
      { add: { category: ['x'] } },
      { origin: 'postr:media-backfill' }
    )
    assert.equal(requests.length, 0)
    await postr.posts.update(post.id, { add: { comment: ['y'] } }, { origin: 'plugin:webmention' })
    assert.equal(requests.length, 2)
  })

  it('ignores drafts until they are published', async () => {
    const { postr, requests } = setup()
    const draft = await postr.posts.create(note({ 'post-status': ['draft'] }))
    await postr.posts.update(draft.id, { replace: { content: ['edited'] } })
    assert.equal(requests.length, 0)
    await postr.posts.update(draft.id, { replace: { 'post-status': ['published'] } })
    assert.deepEqual(requests[0]?.body, { action: 'update', url: draft.url })
  })

  it('pings when a post leaves the site', async () => {
    const { postr, requests } = setup()
    const deleted = await postr.posts.create(note())
    const hidden = await postr.posts.create(note({ 'mp-slug': ['other'] }))
    requests.length = 0
    await postr.posts.delete(deleted.id)
    await postr.posts.update(hidden.id, { replace: { visibility: ['private'] } })
    assert.deepEqual(
      requests.filter((r) => r.url === 'https://deploy.example/hook/secret').map((r) => r.body),
      [
        { action: 'delete', url: deleted.url },
        { action: 'update', url: hidden.url },
      ]
    )
    requests.length = 0
    await postr.posts.update(hidden.id, { replace: { content: ['still private'] } })
    assert.equal(requests.length, 0)
  })

  it('includes the previous URL when the permalink changes', async () => {
    const { postr, requests } = setup()
    const post = await postr.posts.create(note())
    requests.length = 0
    const moved = await postr.posts.update(post.id, { replace: { 'mp-slug': ['moved'] } })
    assert.notEqual(moved.url, post.url)
    assert.deepEqual(requests[0]?.body, { action: 'update', url: moved.url, previousUrl: post.url })
  })

  it('logs failures without failing the save', async () => {
    let calls = 0
    const { postr, warnings } = setup(() => {
      if (calls++ === 0) return new Response(null, { status: 500 })
      throw new Error('offline')
    })
    const post = await postr.posts.create(note())
    assert.ok(await postr.posts.get(post.id))
    assert.deepEqual(
      warnings.toSorted((a, b) => String(a).localeCompare(String(b))),
      [
        ['[postr] webhook deploy.example failed: status 500'],
        ['[postr] webhook site.example failed: offline'],
      ]
    )
  })
})
