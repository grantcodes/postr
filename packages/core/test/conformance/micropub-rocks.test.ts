/**
 * The micropub.rocks server tests (https://micropub.rocks/), run locally through `app.fetch`.
 * Test numbers and expectations match the site; manual "check the post" steps are asserted
 * by reading the post back.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { endpointUrl, json, micropub, tempDir, testPostr } from '../helpers.ts'

const sunset = 'https://micropub.rocks/media/sunset.jpg'
const city = 'https://micropub.rocks/media/city-at-night.jpg'

// Smallest valid file headers; the media store only sniffs the type.
const files = {
  jpg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
  png: new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]),
  gif: new TextEncoder().encode('GIF89a\u0001\u0000\u0001\u0000'),
}

async function setup() {
  return testPostr({
    media: { dir: await tempDir(), url: 'https://example.com/media' },
    downloadExternalMedia: false,
    auth: {
      dangerousToken: 'test-token',
      verify: async (token) =>
        token === 'update-only' ? { me: 'https://example.com/', scope: ['update'] } : null,
    },
  })
}

type Postr = Awaited<ReturnType<typeof setup>>

function form(
  fields: Array<[string, string]>,
  token?: string | null
): RequestInit & { token?: string | null } {
  return { method: 'POST', body: new URLSearchParams(fields), token }
}

/** Asserts the create succeeded and returns the stored post. */
async function created(postr: Postr, res: Response) {
  assert.ok([201, 202].includes(res.status), `expected 201/202, got ${res.status}`)
  const location = res.headers.get('location')
  assert.ok(location, 'missing Location header')
  const post = await postr.posts.getByUrl(location)
  assert.ok(post, `no post at ${location}`)
  return post
}

async function createNote(postr: Postr, properties: Record<string, unknown[]>) {
  return created(postr, await micropub(postr, '', json({ type: ['h-entry'], properties })))
}

describe('micropub.rocks: creating posts', () => {
  it('100 Create an h-entry post (form-encoded)', async () => {
    const postr = await setup()
    const post = await created(
      postr,
      await micropub(
        postr,
        '',
        form([
          ['h', 'entry'],
          ['content', 'Micropub test of creating a basic h-entry'],
        ])
      )
    )
    assert.equal(post.properties.content?.length, 1)
  })

  it('101 Create an h-entry post with multiple categories (form-encoded)', async () => {
    const postr = await setup()
    const post = await created(
      postr,
      await micropub(
        postr,
        '',
        form([
          ['h', 'entry'],
          ['content', 'x'],
          ['category[]', 'test1'],
          ['category[]', 'test2'],
        ])
      )
    )
    assert.deepEqual(post.properties.category, ['test1', 'test2'])
  })

  it('104 Create an h-entry with a photo referenced by URL (form-encoded)', async () => {
    const postr = await setup()
    const post = await created(
      postr,
      await micropub(
        postr,
        '',
        form([
          ['h', 'entry'],
          ['content', 'x'],
          ['photo', sunset],
        ])
      )
    )
    assert.deepEqual(post.properties.photo, [{ value: sunset }])
  })

  it('107 Create an h-entry post with one category (form-encoded)', async () => {
    const postr = await setup()
    const post = await created(
      postr,
      await micropub(
        postr,
        '',
        form([
          ['h', 'entry'],
          ['content', 'x'],
          ['category', 'test1'],
        ])
      )
    )
    assert.deepEqual(post.properties.category, ['test1'])
  })

  it('200 Create an h-entry post (JSON)', async () => {
    const postr = await setup()
    const post = await createNote(postr, {
      content: ['Micropub test of creating an h-entry with a JSON request'],
    })
    assert.equal(post.type, 'h-entry')
  })

  it('201 Create an h-entry post with multiple categories (JSON)', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], category: ['test1', 'test2'] })
    assert.deepEqual(post.properties.category, ['test1', 'test2'])
  })

  it('202 Create an h-entry with HTML content (JSON)', async () => {
    const postr = await setup()
    const html = '<p>This post has <b>bold</b> and <i>italic</i> text.</p>'
    const post = await createNote(postr, { content: [{ html }] })
    assert.deepEqual(post.properties.content, [
      { html, value: 'This post has bold and italic text.' },
    ])
  })

  it('203 Create an h-entry with a photo referenced by URL (JSON)', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], photo: [sunset] })
    assert.deepEqual(post.properties.photo, [{ value: sunset }])
  })

  it('204 Create an h-entry post with a nested object (JSON)', async () => {
    const postr = await setup()
    const checkin = {
      type: ['h-card'],
      properties: {
        name: ['Los Gorditos'],
        'street-address': ['922 NW Davis St'],
        locality: ['Portland'],
        region: ['OR'],
        'country-name': ['United States'],
        'postal-code': ['97209'],
      },
    }
    const post = await createNote(postr, {
      published: ['2017-05-31T12:03:36-07:00'],
      content: ['Lunch meeting'],
      checkin: [checkin],
    })
    assert.deepEqual(post.properties.checkin, [checkin])
    assert.equal(post.published, '2017-05-31T12:03:36-07:00')
    assert.equal(post.postType, 'checkin')
  })

  it('205 Create an h-entry post with a photo with alt text (JSON)', async () => {
    const postr = await setup()
    const post = await createNote(postr, {
      content: ['x'],
      photo: [{ value: sunset, alt: 'Photo of a sunset' }],
    })
    assert.deepEqual(post.properties.photo, [{ value: sunset, alt: 'Photo of a sunset' }])
  })

  it('206 Create an h-entry with multiple photos referenced by URL (JSON)', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], photo: [sunset, city] })
    assert.deepEqual(post.properties.photo, [{ value: sunset }, { value: city }])
  })

  it('300 Create an h-entry with a photo (multipart)', async () => {
    const postr = await setup()
    const body = new FormData()
    body.append('h', 'entry')
    body.append('content', 'Nice sunset tonight')
    body.append('photo', new File([files.jpg], 'sunset.jpg', { type: 'image/jpeg' }))
    const post = await created(postr, await micropub(postr, '', { method: 'POST', body }))
    const [photo] = post.properties.photo as Array<{ value: string }>
    assert.match(photo?.value ?? '', /^https:\/\/example\.com\/media\/.+\/sunset\.jpg$/)
  })

  it('301 Create an h-entry with two photos (multipart)', async () => {
    const postr = await setup()
    const body = new FormData()
    body.append('h', 'entry')
    body.append('content', 'x')
    body.append('photo[]', new File([files.jpg], 'sunset.jpg', { type: 'image/jpeg' }))
    body.append('photo[]', new File([files.jpg], 'city.jpg', { type: 'image/jpeg' }))
    const post = await created(postr, await micropub(postr, '', { method: 'POST', body }))
    assert.equal(post.properties.photo?.length, 2)
  })
})

describe('micropub.rocks: updates', () => {
  async function update(postr: Postr, body: Record<string, unknown>) {
    const res = await micropub(postr, '', json({ action: 'update', ...body }))
    assert.ok([200, 201, 204].includes(res.status), `expected 200/201/204, got ${res.status}`)
    return res
  }

  it('400 Replace a property', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['Micropub update test.'] })
    await update(postr, { url: post.url, replace: { content: ['This is the updated text.'] } })
    assert.equal((await postr.posts.get(post.id))?.properties.content?.length, 1)
    assert.deepEqual((await postr.posts.get(post.id))?.properties.content?.[0], {
      html: '<p>This is the updated text.</p>',
      value: 'This is the updated text.',
    })
  })

  it('401 Add a value to an existing property', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], category: ['test1'] })
    await update(postr, { url: post.url, add: { category: ['test2'] } })
    assert.deepEqual((await postr.posts.get(post.id))?.properties.category, ['test1', 'test2'])
  })

  it('402 Add a value to a non-existent property', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'] })
    await update(postr, { url: post.url, add: { category: ['test1'] } })
    assert.deepEqual((await postr.posts.get(post.id))?.properties.category, ['test1'])
  })

  it('403 Remove a value from a property', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], category: ['test1', 'test2'] })
    await update(postr, { url: post.url, delete: { category: ['test2'] } })
    assert.deepEqual((await postr.posts.get(post.id))?.properties.category, ['test1'])
  })

  it('404 Remove a property', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['x'], category: ['test1', 'test2'] })
    await update(postr, { url: post.url, delete: ['category'] })
    assert.equal((await postr.posts.get(post.id))?.properties.category, undefined)
  })

  it('405 Reject the request if operation is not an array', async () => {
    const postr = await setup()
    const post = await createNote(postr, { content: ['Micropub update test #405.'] })
    const res = await micropub(
      postr,
      '',
      json({ action: 'update', url: post.url, replace: 'This is not a valid update request.' })
    )
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, 'invalid_request')
  })
})

describe('micropub.rocks: delete and undelete', () => {
  for (const [number, encoding] of [
    ['500', 'form-encoded'],
    ['501', 'JSON'],
  ] as const) {
    it(`${number} Delete a post (${encoding})`, async () => {
      const postr = await setup()
      const post = await createNote(postr, { content: ['This post will be deleted'] })
      const res =
        encoding === 'JSON'
          ? await micropub(postr, '', json({ action: 'delete', url: post.url }))
          : await micropub(
              postr,
              '',
              form([
                ['action', 'delete'],
                ['url', post.url],
              ])
            )
      assert.ok([200, 201, 204].includes(res.status))
      assert.equal(await postr.posts.getByUrl(post.url), undefined)
    })
  }

  for (const [number, encoding] of [
    ['502', 'form-encoded'],
    ['503', 'JSON'],
  ] as const) {
    it(`${number} Undelete a post (${encoding})`, async () => {
      const postr = await setup()
      const post = await createNote(postr, { content: ['This post will be deleted and undeleted'] })
      await micropub(postr, '', json({ action: 'delete', url: post.url }))
      const res =
        encoding === 'JSON'
          ? await micropub(postr, '', json({ action: 'undelete', url: post.url }))
          : await micropub(
              postr,
              '',
              form([
                ['action', 'undelete'],
                ['url', post.url],
              ])
            )
      assert.ok([200, 201, 204].includes(res.status))
      assert.equal((await postr.posts.getByUrl(post.url))?.id, post.id)
    })
  }
})

describe('micropub.rocks: queries', () => {
  it('600 Configuration Query', async () => {
    const res = await micropub(await setup(), '?q=config')
    assert.equal(res.status, 200)
    assert.equal(typeof (await res.json()), 'object')
  })

  it('601 Syndication Endpoint Query', async () => {
    const res = await micropub(await setup(), '?q=syndicate-to')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray((await res.json())['syndicate-to']))
  })

  it('602 Source Query (All Properties)', async () => {
    const postr = await setup()
    const post = await createNote(postr, {
      content: ['Test of querying the endpoint for the source content'],
      category: ['micropub', 'test'],
    })
    const res = await micropub(postr, `?q=source&url=${encodeURIComponent(post.url)}`)
    assert.equal(res.status, 200)
    const item = await res.json()
    assert.deepEqual(item.type, ['h-entry'])
    assert.deepEqual(item.properties.category, ['micropub', 'test'])
    assert.ok(item.properties.content)
  })

  it('603 Source Query (Specific Properties)', async () => {
    const postr = await setup()
    const post = await createNote(postr, {
      content: ['x'],
      category: ['micropub', 'test'],
      summary: ['not requested'],
    })
    const query = new URLSearchParams([
      ['q', 'source'],
      ['properties[]', 'content'],
      ['properties[]', 'category'],
      ['url', post.url],
    ])
    const res = await micropub(postr, `?${query.toString()}`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(Object.keys(body.properties).sort(), ['category', 'content'])
    assert.equal(body.type, undefined)
  })
})

describe('micropub.rocks: media endpoint', () => {
  for (const [number, ext, mime] of [
    ['700', 'jpg', 'image/jpeg'],
    ['701', 'png', 'image/png'],
    ['702', 'gif', 'image/gif'],
  ] as const) {
    it(`${number} Upload a ${ext} to the Media Endpoint`, async () => {
      const postr = await setup()
      const config = await (await micropub(postr, '?q=config')).json()
      assert.equal(config['media-endpoint'], `${endpointUrl}/media`)

      const body = new FormData()
      body.append('file', new File([files[ext]], `upload.${ext}`, { type: mime }))
      const res = await micropub(postr, '/media', { method: 'POST', body })
      assert.equal(res.status, 201)
      assert.match(
        res.headers.get('location') ?? '',
        new RegExp(`^https://example\\.com/media/.+\\.${ext}$`)
      )
    })
  }
})

describe('micropub.rocks: authentication', () => {
  it('800 Accept access token in HTTP header', async () => {
    const postr = await setup()
    await created(
      postr,
      await micropub(
        postr,
        '',
        form([
          ['h', 'entry'],
          ['content', 'x'],
        ])
      )
    )
  })

  it('801 Accept access token in POST body', async () => {
    const postr = await setup()
    const res = await micropub(
      postr,
      '',
      form(
        [
          ['h', 'entry'],
          ['content', 'x'],
          ['access_token', 'test-token'],
        ],
        null
      )
    )
    await created(postr, res)
  })

  it('802 Does not store access token property', async () => {
    const postr = await setup()
    const res = await micropub(
      postr,
      '',
      form(
        [
          ['h', 'entry'],
          ['content', 'x'],
          ['access_token', 'test-token'],
        ],
        null
      )
    )
    const post = await created(postr, res)
    const source = await (
      await micropub(postr, `?q=source&url=${encodeURIComponent(post.url)}`)
    ).json()
    assert.equal(source.properties.access_token, undefined)
  })

  it('803 Rejects unauthenticated requests', async () => {
    const res = await micropub(
      await setup(),
      '',
      form(
        [
          ['h', 'entry'],
          ['content', 'x'],
        ],
        null
      )
    )
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error, 'unauthorized')
  })

  it('804 Rejects unauthorized access tokens', async () => {
    const postr = await setup()
    const res = await micropub(
      postr,
      '',
      form(
        [
          ['h', 'entry'],
          ['content', 'x'],
        ],
        'update-only'
      )
    )
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error, 'insufficient_scope')
    assert.equal((await postr.posts.list()).length, 0)
  })

  it('805 Rejects a token in both the header and the body', async () => {
    const postr = await setup()
    const res = await micropub(
      postr,
      '',
      form([
        ['h', 'entry'],
        ['content', 'x'],
        ['access_token', 'test-token'],
      ])
    )
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, 'invalid_request')
    assert.equal((await postr.posts.list()).length, 0)
  })
})
