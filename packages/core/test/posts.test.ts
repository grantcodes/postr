import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PostrError, type PostrPlugin, type SaveEvent } from '../src/index.ts'
import { join } from 'node:path'
import { endpointUrl, fakeFetch, siteUrl, tempDir, testPostr } from './helpers.ts'

describe('posts.create', () => {
  it('stores a note with defaults, formatted content and hashtags', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        content: ['Hello **world** #indieweb'],
        'mp-slug': ['my note'],
        access_token: ['secret'],
      },
    })

    assert.equal(post.postType, 'note')
    assert.equal(post.slug, 'my-note')
    assert.equal(post.status, 'published')
    assert.equal(post.visibility, 'public')
    assert.match(post.path, /^\/\d{4}\/\d{2}\/\d{2}\/my-note$/)
    assert.equal(post.url, siteUrl + post.path)
    assert.deepEqual(post.properties.content, [
      { html: '<p>Hello <strong>world</strong> #indieweb</p>', value: 'Hello world #indieweb' },
    ])
    assert.deepEqual(post.properties.category, ['indieweb'])
    assert.equal(post.properties['mp-slug'], undefined)
    assert.equal(post.properties.access_token, undefined)
    assert.deepEqual(await postr.posts.get(post.id), post)
  })

  it('keeps the published offset for the permalink date and sorts by UTC', async () => {
    const postr = testPostr()
    const late = await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Late'], published: ['2026-06-04T23:30:00-05:00'] },
    })
    const early = await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Early'], published: ['2026-06-05T01:00:00+02:00'] },
    })

    assert.equal(late.path, '/2026/06/04/late')
    assert.equal(late.published, '2026-06-04T23:30:00-05:00')
    assert.equal(late.postType, 'article')
    const listed = await postr.posts.list()
    assert.deepEqual(
      listed.map((p) => p.id),
      [late.id, early.id]
    )
  })

  it('normalizes photos, strips the own permalink url and maps legacy visibility', async () => {
    const postr = testPostr({ downloadExternalMedia: false })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        photo: [
          'https://cdn.example.org/a.jpg',
          { value: 'https://cdn.example.org/b.jpg', alt: 'B' },
        ],
        url: [`${siteUrl}/old`, 'https://elsewhere.example/post'],
        visibility: ['visible'],
        location: ['geo:1,2'],
      },
    })

    assert.equal(post.postType, 'photo')
    assert.deepEqual(post.properties.photo, [
      { value: 'https://cdn.example.org/a.jpg' },
      { value: 'https://cdn.example.org/b.jpg', alt: 'B' },
    ])
    assert.deepEqual(post.properties.url, ['https://elsewhere.example/post'])
    assert.deepEqual(post.properties.location, ['geo:1,2'])
    assert.equal(post.visibility, 'public')
  })

  it('resolves permalink conflicts with a numeric suffix', async () => {
    const postr = testPostr()
    const input = {
      type: ['h-entry'],
      properties: { name: ['Same'], published: ['2026-01-01T10:00:00Z'] },
    }
    const first = await postr.posts.create(input)
    const second = await postr.posts.create(input)
    const third = await postr.posts.create(input)
    assert.deepEqual([first.slug, second.slug, third.slug], ['same', 'same-1', 'same-2'])
  })

  it('rejects invalid input', async () => {
    const postr = testPostr()
    await assert.rejects(
      postr.posts.create({ type: ['entry'], properties: {} }),
      (err: unknown) => err instanceof PostrError && err.code === 'invalid_request'
    )
    await assert.rejects(
      postr.posts.create({ type: ['h-entry'], properties: { published: ['not a date'] } }),
      /Invalid published/
    )
    await assert.rejects(
      postr.posts.create({ type: ['h-entry'], properties: { 'post-status': ['nope'] } }),
      /Invalid post-status/
    )
  })
})

describe('posts.update', () => {
  it('applies replace, add and delete like Micropub', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        content: ['Hi'],
        category: ['a', 'b'],
        summary: ['S'],
        published: ['2026-01-01T10:00:00Z'],
      },
    })

    const updated = await postr.posts.update(post.url, {
      replace: { content: ['Bye'] },
      add: { category: ['c'] },
      delete: { category: ['a'] },
    })
    assert.deepEqual(updated.properties.content, [{ html: '<p>Bye</p>', value: 'Bye' }])
    assert.deepEqual(updated.properties.category, ['b', 'c'])
    assert.equal(updated.published, '2026-01-01T10:00:00Z')
    assert.equal(updated.path, post.path)
    assert.notEqual(updated.updated, post.updated)

    const removed = await postr.posts.update(post.id, { delete: ['summary', 'category'] })
    assert.equal(removed.properties.summary, undefined)
    assert.equal(removed.properties.category, undefined)
  })

  it('moves the permalink when mp-slug or the published date changes', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Title'], published: ['2026-01-01T10:00:00Z'] },
    })
    const renamed = await postr.posts.update(post.url, { replace: { 'mp-slug': ['new-slug'] } })
    assert.equal(renamed.path, '/2026/01/01/new-slug')
    const moved = await postr.posts.update(renamed.url, {
      replace: { published: ['2026-02-02T10:00:00Z'], visibility: ['unlisted'] },
    })
    assert.equal(moved.path, '/2026/02/02/new-slug')
    assert.equal(moved.visibility, 'unlisted')
    assert.equal(await postr.posts.getByUrl(post.url), undefined)
  })

  it('throws not_found for unknown posts', async () => {
    const postr = testPostr()
    await assert.rejects(
      postr.posts.update(`${siteUrl}/nope`, { replace: { name: ['x'] } }),
      (err: unknown) => err instanceof PostrError && err.code === 'not_found'
    )
  })
})

describe('posts.delete / undelete', () => {
  it('hides deleted posts from lookups and lists until undeleted', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({ type: ['h-entry'], properties: { content: ['x'] } })
    await postr.posts.delete(post.url)
    assert.equal(await postr.posts.getByUrl(post.url), undefined)
    assert.ok((await postr.posts.getByUrl(post.url, { includeDeleted: true }))?.deletedAt)
    assert.equal((await postr.posts.list()).length, 0)

    await postr.posts.undelete(post.url)
    assert.equal((await postr.posts.getByUrl(`${post.url}/?utm=1`))?.id, post.id)
  })
})

describe('posts.list', () => {
  it('filters by type, category, properties and visibility', async () => {
    const postr = testPostr({ downloadExternalMedia: false })
    const note = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['n'], category: ['x'] },
    })
    const photo = await postr.posts.create({
      type: ['h-entry'],
      properties: { photo: ['https://cdn.example.org/p.jpg'], category: ['y'] },
    })
    const draft = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['d'], 'post-status': ['draft'] },
    })
    const ids = (posts: Array<{ id: string }>) => posts.map((p) => p.id).sort()

    assert.deepEqual(ids(await postr.posts.list({ postType: 'photo' })), [photo.id])
    assert.deepEqual(ids(await postr.posts.list({ category: 'x' })), [note.id])
    assert.deepEqual(ids(await postr.posts.list({ exists: ['photo'] })), [photo.id])
    assert.deepEqual(ids(await postr.posts.list({ notExists: ['photo'] })), [note.id])
    assert.deepEqual(ids(await postr.posts.list({ properties: { category: 'y' } })), [photo.id])
    assert.deepEqual(ids(await postr.posts.list()), ids([note, photo]))
    assert.deepEqual(
      ids(await postr.posts.list({ includeHidden: true })),
      ids([note, photo, draft])
    )
    assert.equal((await postr.posts.list({ limit: 1, offset: 1 })).length, 1)
    assert.deepEqual(await postr.posts.categories(), ['x', 'y'])
  })

  it('searches name, summary, content and category text', async () => {
    const postr = testPostr()
    const cafe = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        name: ['Café review'],
        content: ['I **loved** the crème brûlée'],
        category: ['food'],
      },
    })
    const ride = await postr.posts.create({
      type: ['h-entry'],
      properties: { summary: ['Long ride'], content: [{ html: '<p>Up the <b>hill</b></p>' }] },
    })
    const draft = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['Draft about cafes'], 'post-status': ['draft'] },
    })
    const search = async (text: string, includeHidden = false) =>
      (await postr.posts.list({ search: text, includeHidden })).map((p) => p.id).sort()

    assert.deepEqual(await search('cafe'), [cafe.id])
    assert.deepEqual(await search('BRUL'), [cafe.id])
    assert.deepEqual(await search('food'), [cafe.id])
    assert.deepEqual(await search('ride hill'), [ride.id])
    assert.deepEqual(await search('cafe hill'), [])
    assert.deepEqual(await search('cafe', true), [cafe.id, draft.id].sort())
    assert.deepEqual(await search('") OR ("'), [])
    assert.deepEqual(await search('   '), [cafe.id, ride.id].sort())

    await postr.posts.update(ride.id, { replace: { summary: ['Short walk'] } })
    assert.deepEqual(await search('ride'), [])
    assert.deepEqual(await search('walk'), [ride.id])
    await postr.posts.delete(cafe.id)
    assert.deepEqual(await search('cafe'), [])
  })
})

describe('posts.toMf2', () => {
  it('returns full mf2 with the column-backed properties', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['x'], published: ['2026-01-01T10:00:00Z'] },
    })
    const item = postr.posts.toMf2(post)
    assert.deepEqual(item.type, ['h-entry'])
    assert.deepEqual(item.properties.url, [post.url])
    assert.deepEqual(item.properties.published, ['2026-01-01T10:00:00Z'])
    assert.deepEqual(item.properties['post-status'], ['published'])
    assert.deepEqual(item.properties.visibility, ['public'])
  })
})

describe('plugin hooks', () => {
  it('runs beforeSave transforms and afterSave with origin', async () => {
    const events: SaveEvent[] = []
    const plugin: PostrPlugin = {
      id: 'test',
      postTypes: [
        {
          type: 'weather',
          name: 'Weather',
          discovery: (item) => Boolean(item.properties.temperature),
        },
      ],
      beforeSave(item) {
        return { ...item, properties: { ...item.properties, summary: ['added'] } }
      },
      async afterSave(event, ctx) {
        events.push(event)
        if (event.origin === 'user' && event.action === 'create') {
          await ctx.postr.posts.update(
            event.post.id,
            { add: { category: ['tagged'] } },
            { origin: 'plugin:test' }
          )
        }
      },
    }
    const postr = testPostr({ plugins: [plugin] })
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { temperature: ['20'], 'mp-syndicate-to': ['x'] },
    })

    assert.equal(post.postType, 'weather')
    assert.deepEqual(post.properties.summary, ['added'])
    assert.deepEqual(
      events.map((e) => [e.action, e.origin]),
      [
        ['create', 'user'],
        ['update', 'plugin:test'],
      ]
    )
    assert.deepEqual(events[0]?.commands, { 'mp-syndicate-to': ['x'] })
    assert.deepEqual((await postr.posts.get(post.id))?.properties.category, ['tagged'])
  })

  it('rejects duplicate plugin ids', () => {
    assert.throws(() => testPostr({ plugins: [{ id: 'a' }, { id: 'a' }] }), /duplicate plugin id/)
  })
})

describe('readOnly', () => {
  it('reads a migrated database but rejects every write and runs no jobs', async () => {
    const database = join(await tempDir(), 'postr.db')
    const writer = testPostr({ database })
    const post = await writer.posts.create({
      type: ['h-entry'],
      properties: { content: ['Hello search'], 'in-reply-to': ['https://other.example/post'] },
    })
    writer.close()

    const fetch = fakeFetch()
    const reader = testPostr({ database, readOnly: true, runJobs: true, fetch })
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(fetch.requests.length, 0)

    assert.equal((await reader.posts.get(post.id))?.id, post.id)
    assert.deepEqual(
      (await reader.posts.list({ search: 'search' })).map((p) => p.id),
      [post.id]
    )
    const forbidden = { code: 'forbidden' }
    await assert.rejects(
      reader.posts.create({ type: ['h-entry'], properties: { content: ['x'] } }),
      forbidden
    )
    await assert.rejects(reader.posts.update(post.id, { replace: { name: ['x'] } }), forbidden)
    await assert.rejects(reader.posts.delete(post.id), forbidden)
    await assert.rejects(reader.posts.undelete(post.id), forbidden)

    const response = await reader.fetch(
      new Request(endpointUrl, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ['h-entry'], properties: { content: ['x'] } }),
      })
    )
    assert.equal(response.status, 403)
    reader.close()
  })

  it('fails to open a missing database', async () => {
    const database = join(await tempDir(), 'missing.db')
    assert.throws(() => testPostr({ database, readOnly: true }))
  })
})
