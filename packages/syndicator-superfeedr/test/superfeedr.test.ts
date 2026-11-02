import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr } from '@postr/core'
import { superfeedr } from '../src/index.ts'

describe('superfeedr syndicator', () => {
  it('pings the hub with every topic after publishing', async () => {
    const pings: string[] = []
    const warnings: unknown[] = []
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      pings.push(`${String(input)} ${String(init?.body)}`)
      return new Response(null, { status: 204 })
    }) as typeof fetch
    const postr = createPostr({
      siteUrl: 'https://example.com',
      endpointUrl: 'https://example.com/micropub',
      database: ':memory:',
      auth: { dangerousToken: 't' },
      runJobs: false,
      logger: { info() {}, warn: (...args) => void warnings.push(args), error: (...args) => void warnings.push(args) },
      fetch: fakeFetch,
      fetchReferences: false,
      sendWebmentions: false,
      plugins: [superfeedr({ hub: 'https://hub.example/', topic: ['https://example.com/', 'https://example.com/feed'] })],
    })
    const post = await postr.posts.create({ type: ['h-entry'], properties: { content: ['x'] } })
    await postr.jobs.runDue()
    assert.deepEqual(pings, [
      'https://hub.example/ hub.mode=publish&hub.url=https%3A%2F%2Fexample.com%2F&hub.url=https%3A%2F%2Fexample.com%2Ffeed',
    ])
    assert.deepEqual(warnings, [])
    assert.equal((await postr.posts.get(post.id))?.properties.syndication, undefined)
  })
})
