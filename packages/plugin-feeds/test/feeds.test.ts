import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPostr } from '@postr/core'
import { feeds, mf2ToJf2 } from '../src/index.ts'

async function setup() {
  const postr = createPostr({
    siteUrl: 'https://example.com',
    endpointUrl: 'https://example.com/micropub',
    database: ':memory:',
    auth: { dangerousToken: 't' },
    runJobs: false,
    plugins: [feeds({ author: { name: 'Grant', photo: 'https://example.com/me.jpg' } })],
  })
  const note = await postr.posts.create({
    type: ['h-entry'],
    properties: { content: ['A note #tag'], published: ['2026-01-01T00:00:00Z'] },
  })
  const article = await postr.posts.create({
    type: ['h-entry'],
    properties: { name: ['Article'], content: ['Body'], published: ['2026-01-02T00:00:00Z'] },
  })
  await postr.posts.create({
    type: ['h-entry'],
    properties: { content: ['secret'], visibility: ['private'] },
  })
  const get = (path: string) =>
    postr.fetch(new Request(`https://example.com/micropub/plugin/feeds${path}`))
  return { postr, note, article, get }
}

describe('feeds plugin', () => {
  it('serves public posts as RSS, Atom and JSON Feed', async () => {
    const { get, note, article } = await setup()

    const rss = await get('/rss')
    assert.equal(rss.status, 200)
    assert.match(rss.headers.get('content-type') ?? '', /rss/)
    const xml = await rss.text()
    assert.ok(xml.includes(article.url) && xml.includes(note.url))
    assert.ok(!xml.includes('secret'))

    assert.match(await (await get('/atom')).text(), /<feed/)
    const json = (await (await get('/json')).json()) as { items: Array<{ title: string }> }
    assert.deepEqual(
      json.items.map((i) => i.title),
      ['Article', 'A note #tag']
    )
  })

  it('filters by post type and category, and 404s when empty', async () => {
    const { get, note, article } = await setup()
    const byType = (await (await get('/mf2json/type/article')).json()) as {
      items: Array<{ properties: { url: string[] } }>
    }
    assert.deepEqual(
      byType.items.map((i) => i.properties.url[0]),
      [article.url]
    )

    const byCategory = (await (await get('/jf2/category/tag')).json()) as {
      children: Array<{ uid: string }>
    }
    assert.deepEqual(
      byCategory.children.map((c) => c.uid),
      [note.url]
    )

    assert.equal((await get('/rss/page/2')).status, 404)
    assert.equal((await get('/nope')).status, 404)
  })

  it('limits the main feeds to the postTypes option', async () => {
    const postr = createPostr({
      siteUrl: 'https://example.com',
      endpointUrl: 'https://example.com/micropub',
      database: ':memory:',
      auth: { dangerousToken: 't' },
      runJobs: false,
      fetchReferences: false,
      plugins: [feeds({ author: { name: 'Grant' }, postTypes: ['note', 'article'] })],
    })
    const note = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['A note'] },
    })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { 'like-of': ['https://them.example/post'] },
    })
    const get = async (path: string) =>
      (await (
        await postr.fetch(new Request(`https://example.com/micropub/plugin/feeds${path}`))
      ).json()) as { items: Array<{ properties: { url: string[] } }> }

    assert.deepEqual(
      (await get('/mf2json')).items.map((i) => i.properties.url[0]),
      [note.url]
    )
    assert.equal((await get('/mf2json/type/like')).items.length, 1)
  })

  it('escapes plain-text content', async () => {
    const postr = createPostr({
      siteUrl: 'https://example.com',
      endpointUrl: 'https://example.com/micropub',
      database: ':memory:',
      auth: { dangerousToken: 't' },
      runJobs: false,
      formatContent: false,
      plugins: [feeds({ author: { name: 'Grant' } })],
    })
    await postr.posts.create({ type: ['h-entry'], properties: { content: ['<b>bold</b>'] } })
    const response = await postr.fetch(
      new Request('https://example.com/micropub/plugin/feeds/json')
    )
    const json = (await response.json()) as { items: Array<{ content_html: string }> }
    assert.equal(json.items[0]?.content_html, '<p>&#60;b&#62;bold&#60;/b&#62;</p>')
  })
})

describe('mf2ToJf2', () => {
  it('flattens single values and converts content, photos and nested items', () => {
    assert.deepEqual(
      mf2ToJf2({
        type: ['h-entry'],
        properties: {
          url: ['https://example.com/a'],
          content: [{ html: '<p>x</p>', value: 'x' }],
          photo: [{ value: 'https://example.com/p.jpg', alt: '' }],
          category: ['a', 'b'],
          author: [{ type: ['h-card'], properties: { name: ['Grant'] } }],
          'post-status': ['published'],
        },
      }),
      {
        type: 'entry',
        uid: 'https://example.com/a',
        url: 'https://example.com/a',
        content: { html: '<p>x</p>', text: 'x' },
        photo: 'https://example.com/p.jpg',
        category: ['a', 'b'],
        author: { type: 'card', name: 'Grant' },
      }
    )
  })
})
