import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { postrLoader, postrLiveLoader } from '../src/index.ts'
import { endpointUrl, fakeContext, postrFetch, seed, testPostr, token } from './helpers.ts'

describe('HTTP source', () => {
  it('reads the same entries as the in-process source, apart from references', async () => {
    const postr = testPostr()
    await seed(postr)
    for (let i = 0; i < 105; i++) {
      await postr.posts.create({ type: ['h-entry'], properties: { content: [`Post ${i}`] } })
    }
    const fetch = postrFetch(postr)
    const local = fakeContext()
    const remote = fakeContext()
    await postrLoader({ postr }).load(local.context)
    await postrLoader({ endpoint: endpointUrl, token, fetch }).load(remote.context)

    assert.equal(remote.entries.size, 107)
    assert.deepEqual([...remote.entries], [...local.entries])
    assert.ok(fetch.urls.some((url) => url.includes('after=100')))
  })

  it('maps filters to q=source parameters', async () => {
    const postr = testPostr()
    const { article } = await seed(postr)
    const fetch = postrFetch(postr)
    const fake = fakeContext()
    await postrLoader({ endpoint: endpointUrl, token, fetch, category: 'news' }).load(fake.context)
    assert.deepEqual([...fake.entries.keys()], [article.path.slice(1)])
    const url = new URL(fetch.urls[0] ?? '')
    assert.equal(url.searchParams.get('q'), 'source')
    assert.equal(url.searchParams.get('property-category'), 'news')

    const live = postrLiveLoader({ endpoint: endpointUrl, token, fetch })
    const found = await live.loadCollection({
      collection: 'posts',
      filter: { search: 'article', postType: 'photo' },
    })
    assert.ok('entries' in found)
    assert.equal(found.entries.length, 1)
    const last = new URL(fetch.urls.at(-1) ?? '')
    assert.equal(last.searchParams.get('search'), 'article')
    assert.equal(last.searchParams.get('post-type'), 'photo')
  })

  it('sends the token as a bearer header', async () => {
    const seen: Array<string | null> = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push(new Request(input, init).headers.get('authorization'))
      return Response.json({ items: [] })
    }) as typeof globalThis.fetch
    await postrLoader({ endpoint: endpointUrl, token, fetch }).load(fakeContext().context)
    assert.deepEqual(seen, [`Bearer ${token}`])
  })

  it('discovers custom post types with the postTypes option', async () => {
    const weather = {
      type: 'weather',
      name: 'Weather',
      discovery: (item: { properties: Record<string, unknown[]> }) =>
        Boolean(item.properties.temperature),
    }
    const postr = testPostr({ plugins: [{ id: 'weather', postTypes: [weather] }] })
    await postr.posts.create({ type: ['h-entry'], properties: { temperature: ['20'] } })
    const fetch = postrFetch(postr)

    const plain = fakeContext()
    await postrLoader({ endpoint: endpointUrl, token, fetch }).load(plain.context)
    const custom = fakeContext()
    await postrLoader({ endpoint: endpointUrl, token, fetch, postTypes: [weather] }).load(
      custom.context
    )
    const postType = (fake: typeof plain) =>
      ([...fake.entries.values()][0]?.data as { postType: string } | undefined)?.postType
    assert.notEqual(postType(plain), 'weather')
    assert.equal(postType(custom), 'weather')
  })
})
