import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { endpointUrl, fakeFetch, json, micropub, siteUrl, tempDir, testPostr } from './helpers.ts'

describe('Micropub auth', () => {
  it('requires a token', async () => {
    const res = await micropub(testPostr(), '?q=config', { token: null })
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error, 'unauthorized')
  })

  it('verifies tokens with the token endpoint', async () => {
    const tokenFetch = fakeFetch({
      'https://tokens.example/token': (req) => {
        const token = req.headers.get('authorization')
        if (token === 'Bearer good') {
          return Response.json({ me: `${siteUrl}/`, scope: 'create', client_id: 'app' })
        }
        if (token === 'Bearer other') {
          return Response.json({ me: 'https://other.example/', scope: 'create' })
        }
        return new Response('', { status: 401 })
      },
    })
    const postr = testPostr({
      auth: { tokenEndpoint: 'https://tokens.example/token' },
      fetch: tokenFetch,
    })

    assert.equal((await micropub(postr, '', { token: 'good' })).status, 200)
    assert.equal((await micropub(postr, '', { token: 'other' })).status, 403)
    assert.equal((await micropub(postr, '', { token: 'bad' })).status, 403)

    const created = await micropub(postr, '', {
      ...json({ type: ['h-entry'], properties: { content: ['x'] } }),
      token: 'good',
    })
    assert.equal(created.status, 201)
    const deleted = await micropub(postr, '', {
      ...json({ action: 'delete', url: created.headers.get('location') }),
      token: 'good',
    })
    assert.equal(deleted.status, 401)
    assert.equal((await deleted.json()).error, 'insufficient_scope')
  })

  it('accepts access_token in a form body', async () => {
    const postr = testPostr()
    const res = await micropub(postr, '', {
      method: 'POST',
      token: null,
      body: new URLSearchParams({ h: 'entry', content: 'hi', access_token: 'test-token' }),
    })
    assert.equal(res.status, 201)
  })
})

describe('Micropub create', () => {
  it('creates from form-encoded bodies', async () => {
    const postr = testPostr()
    const body = new URLSearchParams([
      ['h', 'entry'],
      ['content', 'Hello'],
      ['category[]', 'one'],
      ['category[]', 'two'],
      ['mp-slug', 'hello'],
    ])
    const res = await micropub(postr, '', { method: 'POST', body })
    assert.equal(res.status, 201)
    const location = res.headers.get('location') ?? ''
    assert.match(location, /^https:\/\/example\.com\/\d{4}\/\d{2}\/\d{2}\/hello$/)
    const post = await postr.posts.getByUrl(location)
    assert.deepEqual(post?.properties.category, ['one', 'two'])
  })

  it('creates from JSON with nested values', async () => {
    const postr = testPostr()
    const res = await micropub(
      postr,
      '',
      json({
        type: ['h-entry'],
        properties: { content: [{ html: '<p>Hi <a href="https://a.example/">a</a></p>' }] },
      })
    )
    assert.equal(res.status, 201)
    const { item } = await res.json()
    assert.deepEqual(item.properties.content, [
      { html: '<p>Hi <a href="https://a.example/">a</a></p>', value: 'Hi a' },
    ])
  })

  it('saves multipart photo uploads to the media store', async () => {
    const dir = await tempDir()
    const postr = testPostr({ media: { dir, url: 'https://media.example.com' } })
    const form = new FormData()
    form.append('h', 'entry')
    form.append('photo', new File([new Uint8Array([1, 2, 3])], 'my photo.bin'))
    const res = await micropub(postr, '', { method: 'POST', body: form })
    assert.equal(res.status, 201)
    const post = await postr.posts.getByUrl(res.headers.get('location') ?? '')
    const photo = post?.properties.photo?.[0] as { value: string }
    assert.match(photo.value, /^https:\/\/media\.example\.com\/\d{4}\/\d{2}\/\d{2}\/my-photo\.bin$/)
    const path = join(dir, photo.value.replace('https://media.example.com/', ''))
    assert.deepEqual([...(await readFile(path))], [1, 2, 3])
  })

  it('rejects invalid posts', async () => {
    const res = await micropub(
      testPostr(),
      '',
      json({ type: ['h-entry'], properties: { content: 'x' } })
    )
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, 'invalid_request')
  })

  it('rejects empty posts and non-object bodies', async () => {
    const postr = testPostr()
    for (const body of [null, { type: ['h-entry'], properties: { 'mp-slug': ['x'] } }]) {
      assert.equal((await micropub(postr, '', json(body))).status, 400)
    }
    assert.equal((await micropub(postr, '', { method: 'POST' })).status, 400)
    assert.equal((await postr.posts.list({ includeHidden: true })).length, 0)
  })
})

describe('Micropub actions', () => {
  it('updates, deletes and undeletes', async () => {
    const postr = testPostr()
    const post = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['a'], name: ['N'] },
    })

    const updated = await micropub(
      postr,
      '',
      json({ action: 'update', url: post.url, replace: { content: ['b'] } })
    )
    assert.equal(updated.status, 200)
    assert.equal((await postr.posts.get(post.id))?.properties.content?.[0] && 'ok', 'ok')

    const moved = await micropub(
      postr,
      '',
      json({ action: 'update', url: post.url, replace: { 'mp-slug': ['moved'] } })
    )
    assert.equal(moved.status, 201)
    assert.match(moved.headers.get('location') ?? '', /\/moved$/)

    const formUpdate = await micropub(postr, '', {
      method: 'POST',
      body: new URLSearchParams({ action: 'update', url: post.url }),
    })
    assert.equal(formUpdate.status, 400)

    const url = (await postr.posts.get(post.id))?.url ?? ''
    const deleted = await micropub(postr, '', {
      method: 'POST',
      body: new URLSearchParams({ action: 'delete', url }),
    })
    assert.equal(deleted.status, 200)
    assert.equal(await postr.posts.getByUrl(url), undefined)

    const restored = await micropub(postr, '', json({ action: 'undelete', url }))
    assert.equal(restored.status, 200)
    assert.ok(await postr.posts.getByUrl(url))
  })

  it('returns invalid_request for unknown posts', async () => {
    const res = await micropub(
      testPostr(),
      '',
      json({ action: 'delete', url: `${siteUrl}/missing` })
    )
    assert.equal(res.status, 400)
  })
})

describe('Micropub queries', () => {
  it('returns config with syndication targets and post types', async () => {
    const postr = testPostr({
      media: { dir: await tempDir(), url: 'https://media.example.com' },
      plugins: [
        {
          id: 'social',
          name: 'Social',
          syndication: { default: true, syndicate: async () => null },
        },
      ],
      micropubConfig: { extra: true },
    })
    const config = await (await micropub(postr, '?q=config')).json()
    assert.equal(config['media-endpoint'], `${endpointUrl}/media`)
    assert.deepEqual(config['syndicate-to'], [{ uid: 'social', name: 'Social', checked: true }])
    assert.ok(config['post-types'].some((t: { type: string }) => t.type === 'note'))
    assert.equal(config.extra, true)

    const targets = await (await micropub(postr, '?q=syndicate-to')).json()
    assert.deepEqual(targets['syndicate-to'], config['syndicate-to'])
    assert.equal((await micropub(postr, '?q=nope')).status, 400)
  })

  it('returns sources, source lists and categories', async () => {
    const postr = testPostr()
    const first = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['one'], category: ['Cats'], published: ['2026-01-01T00:00:00Z'] },
    })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Two'], category: ['dogs'], published: ['2026-01-02T00:00:00Z'] },
    })

    const source = await (
      await micropub(postr, `?q=source&url=${encodeURIComponent(first.url)}`)
    ).json()
    assert.deepEqual(source.properties.category, ['Cats'])
    const partial = await (
      await micropub(postr, `?q=source&properties[]=category&url=${encodeURIComponent(first.url)}`)
    ).json()
    assert.deepEqual(partial, { properties: { category: ['Cats'] } })

    const page = await (await micropub(postr, '?q=source&limit=1')).json()
    assert.equal(page.items.length, 1)
    assert.deepEqual(page.items[0].properties.name, ['Two'])
    assert.deepEqual(page.paging, { after: '1' })
    const next = await (await micropub(postr, '?q=source&limit=1&after=1')).json()
    assert.deepEqual(next.items[0].properties.url, [first.url])
    const articles = await (await micropub(postr, '?q=source&post-type=article')).json()
    assert.equal(articles.items.length, 1)
    const found = await (await micropub(postr, '?q=source&search=cat')).json()
    assert.deepEqual(found.items[0].properties.url, [first.url])
    assert.equal(found.items.length, 1)

    const categories = await (await micropub(postr, '?q=category&search=CA')).json()
    assert.deepEqual(categories, { categories: ['Cats'] })
  })
})

describe('Media endpoint', () => {
  it('stores uploads and returns the location', async () => {
    const dir = await tempDir()
    const postr = testPostr({ media: { dir, url: 'https://media.example.com/' } })
    const form = new FormData()
    form.append('file', new File(['hello'], '../../etc/passwd.txt'))
    const res = await micropub(postr, '/media', { method: 'POST', body: form })
    assert.equal(res.status, 201)
    const location = res.headers.get('location') ?? ''
    assert.match(location, /^https:\/\/media\.example\.com\/\d{4}\/\d{2}\/\d{2}\/passwd\.txt$/)

    const again = await micropub(postr, '/media', { method: 'POST', body: form })
    assert.match(again.headers.get('location') ?? '', /passwd-1\.txt$/)
  })

  it('writes configured image sizes for larger images and adds them to posts', async () => {
    const { default: sharp } = await import('sharp')
    const png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#f00' },
    })
      .png()
      .toBuffer()
    const dir = await tempDir()
    const postr = testPostr({
      media: {
        dir,
        url: 'https://media.example.com',
        imageSizes: { small: [10, 10], huge: [100] },
      },
    })
    const form = new FormData()
    form.append('file', new File([new Uint8Array(png)], 'red'))
    const location =
      (await micropub(postr, '/media', { method: 'POST', body: form })).headers.get('location') ??
      ''
    assert.match(location, /\/red\.png$/)
    const small = join(
      dir,
      location.replace('https://media.example.com/', '').replace('.png', '-small.png')
    )
    assert.deepEqual(
      await sharp(small)
        .metadata()
        .then(({ width, height }) => [width, height]),
      [10, 10]
    )
    await assert.rejects(readFile(small.replace('-small', '-huge')))

    const post = await postr.posts.create({ type: ['h-entry'], properties: { photo: [location] } })
    assert.deepEqual(post.properties.photo, [
      {
        value: location,
        width: 40,
        height: 20,
        sizes: { small: { url: location.replace('.png', '-small.png'), width: 10, height: 10 } },
      },
    ])
    const source = await (
      await micropub(postr, `?q=source&properties[]=photo&url=${encodeURIComponent(post.url)}`)
    ).json()
    assert.deepEqual(source.properties.photo, post.properties.photo)
  })

  it('rejects uploads when media is not configured', async () => {
    const form = new FormData()
    form.append('file', new File(['x'], 'x.txt'))
    const res = await micropub(testPostr(), '/media', { method: 'POST', body: form })
    assert.equal(res.status, 400)
  })
})
