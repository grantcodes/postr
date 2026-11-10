import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { PostrPlugin } from '../src/index.ts'
import { fakeFetch, json, micropub, tempDir, testPostr } from './helpers.ts'

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(`<!doctype html><html><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  })

describe('references', () => {
  it('fetches h-entry snapshots of replied-to posts', async () => {
    const fetch = fakeFetch({
      'https://them.example/post': () =>
        html(
          '<article class="h-entry"><h1 class="p-name">Their post</h1><a class="u-url" href="/post">x</a></article>'
        ),
    })
    const postr = testPostr({ fetch, sendWebmentions: false })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['Nice'], 'in-reply-to': ['https://them.example/post'] },
    })
    assert.equal(post.postType, 'reply')
    await postr.jobs.runDue()

    const refs = await postr.posts.references(post)
    assert.deepEqual(refs['https://them.example/post']?.properties.name, ['Their post'])
  })

  it('falls back to Readability for pages without microformats', async () => {
    const paragraph = '<p>' + 'Some long article text. '.repeat(40) + '</p>'
    const fetch = fakeFetch({
      'https://news.example/a': () =>
        html(`<header>Nav</header><article><h1>Headline</h1>${paragraph}${paragraph}</article>`),
    })
    const postr = testPostr({ fetch, sendWebmentions: false })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { 'bookmark-of': ['https://news.example/a'] },
    })
    await postr.jobs.runDue()
    const ref = (await postr.posts.references(post))['https://news.example/a']
    assert.ok(ref?.properties.content)
    assert.deepEqual(ref?.properties.url, ['https://news.example/a'])
  })
})

describe('webmentions', () => {
  it('sends to endpoints found in Link headers and HTML, for old and new links', async () => {
    const received: string[] = []
    const endpoint = async (req: Request) => {
      const form = new URLSearchParams(await req.text())
      received.push(`${req.url} ${form.get('target')}`)
      return new Response('', { status: 202 })
    }
    const fetch = fakeFetch({
      'https://a.example/': () => html('', { link: '</wm>; rel="webmention"' }),
      'https://a.example/wm': endpoint,
      'https://b.example/': () => html('<link rel="webmention" href="https://b.example/endpoint">'),
      'https://b.example/endpoint': endpoint,
      'https://c.example/': () => html('no endpoint'),
    })
    const postr = testPostr({ fetch, fetchReferences: false })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        content: [
          { html: '<a href="https://a.example/">a</a> <a href="https://c.example/">c</a>' },
        ],
        'like-of': ['https://b.example/'],
      },
    })
    await postr.jobs.runDue()
    assert.deepEqual(received.sort(), [
      'https://a.example/wm https://a.example/',
      'https://b.example/endpoint https://b.example/',
    ])

    received.length = 0
    await postr.posts.update(post.id, { delete: ['like-of'] })
    await postr.jobs.runDue()
    assert.ok(received.includes('https://b.example/endpoint https://b.example/'))
  })

  it('does not send for private posts and retries failures with backoff', async () => {
    let calls = 0
    const fetch = fakeFetch({
      'https://a.example/': () => html('', { link: '<https://a.example/wm>; rel=webmention' }),
      'https://a.example/wm': () => {
        calls++
        return new Response('', { status: 500 })
      },
    })
    const postr = testPostr({ fetch, fetchReferences: false })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['https://a.example/'], visibility: ['private'] },
    })
    await postr.jobs.runDue()
    assert.equal(calls, 0)

    await postr.posts.create({ type: ['h-entry'], properties: { content: ['https://a.example/'] } })
    assert.equal(await postr.jobs.runDue(), 1)
    assert.equal(calls, 1)
    // The failed job is rescheduled into the future, so nothing is due now.
    assert.equal(await postr.jobs.runDue(), 0)
  })
})

describe('syndication', () => {
  it('syndicates default and requested targets once, adding the syndication URL', async () => {
    const syndicated: string[] = []
    const target = (id: string, isDefault: boolean): PostrPlugin => ({
      id,
      syndication: {
        default: isDefault,
        async syndicate(post) {
          syndicated.push(`${id} ${post.id}`)
          return `https://${id}.example/${post.slug}`
        },
      },
    })
    const postr = testPostr({
      plugins: [target('one', true), target('two', false)],
      sendWebmentions: false,
    })

    const plain = await postr.posts.create({ type: ['h-entry'], properties: { content: ['a'] } })
    const chosen = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['b'], 'mp-syndicate-to': ['two'] },
    })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['c'], 'post-status': ['draft'] },
    })
    await postr.jobs.runDue()

    assert.deepEqual(syndicated.sort(), [`one ${plain.id}`, `two ${chosen.id}`].sort())
    assert.deepEqual((await postr.posts.get(plain.id))?.properties.syndication, [
      `https://one.example/${plain.slug}`,
    ])
    await postr.jobs.runDue()
    assert.equal(syndicated.length, 2)
  })

  it('syndicates a draft to the default targets when it is published', async () => {
    const syndicated: string[] = []
    const postr = testPostr({
      plugins: [
        {
          id: 'one',
          syndication: {
            default: true,
            async syndicate(post) {
              syndicated.push(post.id)
              return null
            },
          },
        },
      ],
      sendWebmentions: false,
    })
    const draft = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['a'], 'post-status': ['draft'] },
    })
    await postr.posts.update(draft.id, { replace: { 'post-status': ['published'] } })
    await postr.posts.update(draft.id, { replace: { content: ['b'] } })
    await postr.jobs.runDue()
    assert.deepEqual(syndicated, [draft.id])
  })
})

describe('external media', () => {
  it('downloads external photos into the media store on create', async () => {
    const dir = await tempDir()
    const fetch = fakeFetch({
      'https://cdn.example.org/pic.png': () =>
        new Response(new Uint8Array([9, 9]), { headers: { 'content-type': 'image/png' } }),
    })
    const postr = testPostr({
      fetch,
      media: { dir, url: 'https://example.com/media' },
      fetchReferences: false,
      sendWebmentions: false,
    })
    const res = await micropub(
      postr,
      '',
      json({
        type: ['h-entry'],
        properties: {
          photo: [
            { value: 'https://cdn.example.org/pic.png', alt: 'Pic' },
            'https://missing.example/x.png',
          ],
        },
      })
    )
    const { item } = await res.json()
    const [saved, missing] = item.properties.photo
    assert.match(saved.value, /^https:\/\/example\.com\/media\/\d{4}\/\d{2}\/\d{2}\/pic\.png$/)
    assert.equal(saved.alt, 'Pic')
    assert.deepEqual(missing, { value: 'https://missing.example/x.png' })
    const file = join(dir, saved.value.replace('https://example.com/media/', ''))
    assert.deepEqual([...(await readFile(file))], [9, 9])
  })

  it('does not download files already in a custom media store', async () => {
    let saves = 0
    const postr = testPostr({
      fetch: fakeFetch({}),
      media: {
        url: 'https://media.example.com',
        async save() {
          saves++
          return 'https://media.example.com/copy.png'
        },
      },
      fetchReferences: false,
      sendWebmentions: false,
    })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { photo: ['https://media.example.com/pic.png'] },
    })
    assert.equal(saves, 0)
    assert.deepEqual(post.properties.photo, [{ value: 'https://media.example.com/pic.png' }])
  })
})
