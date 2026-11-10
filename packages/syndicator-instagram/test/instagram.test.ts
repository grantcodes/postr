import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import { createPostr } from '@postr/core'
import { instagram, instagramUrlToId, type InstagramPhoto } from '../src/index.ts'

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#0af' } })
    .png()
    .toBuffer()

async function setup() {
  const published: Array<{ photos: InstagramPhoto[]; caption: string }> = []
  const liked: string[] = []
  const files: Record<string, Buffer> = {
    'https://cdn.example.org/wide.png': await image(400, 100),
    'https://cdn.example.org/square.png': await image(100, 100),
  }
  const fakeFetch = (async (input: string | URL) => {
    const file = files[String(input)]
    return file ? new Response(new Uint8Array(file)) : new Response('', { status: 404 })
  }) as typeof fetch
  const postr = createPostr({
    siteUrl: 'https://example.com',
    endpointUrl: 'https://example.com/micropub',
    database: ':memory:',
    auth: { dangerousToken: 't' },
    runJobs: false,
    fetch: fakeFetch,
    downloadExternalMedia: false,
    fetchReferences: false,
    sendWebmentions: false,
    plugins: [
      instagram({
        username: 'me',
        password: 'pw',
        client: async () => ({
          async publish(photos, caption) {
            published.push({ photos, caption })
            return `CODE${published.length}`
          },
          async like(mediaId) {
            liked.push(mediaId)
          },
        }),
      }),
    ],
  })
  return { postr, published, liked }
}

describe('instagram syndicator', () => {
  it('publishes photos fitted to Instagram sizes with a caption', async () => {
    const { postr, published } = await setup()
    const single = await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['Sky'], photo: ['https://cdn.example.org/wide.png'] },
    })
    const album = await postr.posts.create({
      type: ['h-entry'],
      properties: {
        photo: ['https://cdn.example.org/wide.png', 'https://cdn.example.org/square.png'],
      },
    })
    await postr.jobs.runDue()

    assert.equal(published.length, 2)
    const [first, second] = published
    assert.equal(first?.caption, `Sky • Originally posted to ${single.url}`)
    assert.deepEqual(
      first?.photos.map((p) => [p.width, p.height]),
      [[2000, 2000]]
    )
    assert.deepEqual(
      second?.photos.map((p) => [p.width, p.height]),
      [
        [2000, 2000],
        [2000, 2000],
      ]
    )
    assert.deepEqual((await postr.posts.get(single.id))?.properties.syndication, [
      'https://www.instagram.com/p/CODE1/',
    ])
    assert.deepEqual((await postr.posts.get(album.id))?.properties.syndication, [
      'https://www.instagram.com/p/CODE2/',
    ])
  })

  it('likes Instagram posts and skips other likes', async () => {
    const { postr, liked, published } = await setup()
    const like = await postr.posts.create({
      type: ['h-entry'],
      properties: { 'like-of': ['https://www.instagram.com/p/B/'] },
    })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { 'like-of': ['https://other.example/'] },
    })
    await postr.jobs.runDue()

    assert.deepEqual(liked, ['1'])
    assert.equal(published.length, 0)
    assert.deepEqual((await postr.posts.get(like.id))?.properties.syndication, [
      'https://www.instagram.com/p/B/#likedby-me',
    ])
  })

  it('decodes shortcodes to media ids', () => {
    assert.equal(
      instagramUrlToId('https://www.instagram.com/p/BAAAAAAAAAA/'),
      (2n ** 60n).toString()
    )
  })
})
