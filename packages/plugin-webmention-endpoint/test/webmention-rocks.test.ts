/**
 * The webmention.rocks receiver tests (https://webmention.rocks/receive/1 and /2), run locally.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr } from '@postr/core'
import { webmentionEndpoint } from '../src/index.ts'

const source = 'https://webmention.rocks/receive/1/abc'

async function setup() {
  let target = ''
  const fakeFetch = (async (input: string | URL) => {
    assert.equal(String(input), source)
    return new Response(
      `<div class="h-entry"><p class="e-content"><a href="${target}">Mentioning you</a></p></div>`,
      { headers: { 'content-type': 'text/html' } }
    )
  }) as typeof fetch
  const postr = createPostr({
    siteUrl: 'https://example.com',
    endpointUrl: 'https://example.com/micropub',
    database: ':memory:',
    auth: { dangerousToken: 't' },
    runJobs: false,
    fetch: fakeFetch,
    plugins: [webmentionEndpoint()],
  })
  const post = await postr.posts.create({ type: ['h-entry'], properties: { name: ['Target'] } })
  target = post.url
  const send = (body: Record<string, string>) =>
    postr.fetch(
      new Request('https://example.com/micropub/plugin/webmention', {
        method: 'POST',
        body: new URLSearchParams(body),
      })
    )
  return { postr, post, target, send }
}

describe('webmention.rocks receiver', () => {
  it('1 Accepts valid Webmention request', async () => {
    const { send, target } = await setup()
    assert.ok([200, 201, 202].includes((await send({ source, target })).status))
  })

  it('2 Validates source and target URLs', async () => {
    const { postr, post, target, send } = await setup()
    for (const body of [
      { source: 'jwoijgoisdjlskjegisvjowuehjtkx', target },
      { source, target: 'owiejduvyeiwljjjcjmvbpsouehgd' },
      { source: 'jwoijgoisdjlskjegisvjowuehjtkx', target: 'owiejduvyeiwljjjcjmvbpsouehgd' },
      { source: 'mailto:someone@example.com', target },
      { source, target: 'ftp://example.com/post' },
    ]) {
      assert.equal((await send(body)).status, 400, JSON.stringify(body))
    }
    assert.equal((await postr.posts.get(post.id))?.properties.mention, undefined)
  })
})
