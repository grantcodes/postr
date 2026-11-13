import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { postrLoader } from '../src/index.ts'
import { fakeContext, postrFetch, seed, siteUrl, testPostr } from './helpers.ts'

describe('postrLoader', () => {
  it('stores published public posts with a path id, projection and rendered html', async () => {
    const postr = testPostr()
    const { note, article } = await seed(postr)
    const fake = fakeContext()
    await postrLoader({ postr }).load(fake.context)

    assert.deepEqual([...fake.entries.keys()], [article.path.slice(1), note.path.slice(1)])
    const entry = fake.entries.get('2026/01/01/hello') as {
      data: Record<string, unknown>
      rendered?: { html: string }
    }
    assert.equal(entry.data.url, `${siteUrl}/2026/01/01/hello`)
    assert.equal(entry.data.path, '/2026/01/01/hello')
    assert.equal(entry.data.postType, 'note')
    assert.deepEqual(entry.data.published, new Date('2026-01-01T10:00:00Z'))
    assert.deepEqual(entry.data.categories, ['indieweb'])
    assert.deepEqual(entry.data.content, {
      html: '<p>Hello <strong>world</strong> #indieweb</p>',
      text: 'Hello world #indieweb',
    })
    assert.equal(entry.rendered?.html, '<p>Hello <strong>world</strong> #indieweb</p>')

    const articleData = fake.entries.get(article.path.slice(1))?.data as Record<string, unknown>
    assert.equal(articleData.name, 'An article')
    assert.equal(articleData.postType, 'photo')
    assert.deepEqual(articleData.categories, ['news'])
    assert.deepEqual(articleData.photos, [
      {
        url: 'https://example.com/media/a.jpg',
        alt: 'A photo',
        width: 1200,
        height: 800,
        sizes: { '600': { url: 'https://example.com/media/a-600.jpg', width: 600, height: 400 } },
      },
    ])
    assert.equal((articleData.properties as Record<string, unknown[]>).category?.length, 2)
  })

  it('drops an implied name that repeats the content', async () => {
    const postr = testPostr()
    await postr.posts.create({
      type: ['h-entry'],
      properties: { name: ['Same text'], content: ['Same text'], 'mp-slug': ['same'] },
    })
    const fake = fakeContext()
    await postrLoader({ postr }).load(fake.context)
    const [entry] = fake.entries.values()
    assert.ok(entry)
    assert.equal((entry.data as Record<string, unknown>).name, undefined)
  })

  it('includes unlisted, private and draft posts only when asked', async () => {
    const postr = testPostr()
    const posts = await seed(postr)
    const fake = fakeContext()
    await postrLoader({ postr, visibility: ['public', 'unlisted'], drafts: true }).load(
      fake.context
    )
    const ids = new Set(fake.entries.keys())
    for (const post of [posts.note, posts.article, posts.unlisted, posts.draft]) {
      assert.ok(ids.has(post.path.slice(1)), post.path)
    }
    assert.ok(!ids.has(posts.hidden.path.slice(1)))
    assert.ok(!ids.has(posts.deleted.path.slice(1)))
  })

  it('filters by post type and category', async () => {
    const postr = testPostr()
    const { note, article } = await seed(postr)
    const notes = fakeContext()
    await postrLoader({ postr, postType: 'note' }).load(notes.context)
    assert.deepEqual([...notes.entries.keys()], [note.path.slice(1)])
    const news = fakeContext()
    await postrLoader({ postr, category: 'news' }).load(news.context)
    assert.deepEqual([...news.entries.keys()], [article.path.slice(1)])
  })

  it('re-syncs only changed posts and removes deleted ones', async () => {
    const postr = testPostr()
    const { note, article } = await seed(postr)
    const fake = fakeContext()
    const loader = postrLoader({ postr })
    await loader.load(fake.context)
    assert.equal(fake.parsed, 2)

    await postr.posts.update(note.id, { replace: { content: ['Changed'] } })
    await postr.posts.delete(article.id)
    await loader.load(fake.context)

    assert.equal(fake.parsed, 3)
    assert.deepEqual([...fake.entries.keys()], [note.path.slice(1)])
    const data = fake.entries.get(note.path.slice(1))?.data as { content: { text: string } }
    assert.equal(data.content.text, 'Changed')
  })

  it('pages through every post', async () => {
    const postr = testPostr()
    for (let i = 0; i < 120; i++) {
      await postr.posts.create({ type: ['h-entry'], properties: { content: [`Post ${i}`] } })
    }
    const fake = fakeContext()
    await postrLoader({ postr }).load(fake.context)
    assert.equal(fake.entries.size, 120)
  })

  it('escapes plain-text content', async () => {
    const postr = testPostr({ formatContent: false })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['<b>not html</b>'], 'mp-slug': ['plain'] },
    })
    const fake = fakeContext()
    await postrLoader({ postr }).load(fake.context)
    const [entry] = fake.entries.values() as Iterable<{ rendered?: { html: string } }>
    assert.equal(entry?.rendered?.html, '<p>&#60;b&#62;not html&#60;/b&#62;</p>')
  })

  it('adds fetched references', async () => {
    const reply = 'https://other.example/post'
    const postr = testPostr({
      fetch: async (input) =>
        new Request(input).url === reply
          ? new Response('<div class="h-entry"><p class="p-name e-content">Original</p></div>', {
              headers: { 'content-type': 'text/html' },
            })
          : new Response('Not found', { status: 404 }),
      sendWebmentions: false,
    })
    await postr.posts.create({
      type: ['h-entry'],
      properties: { content: ['Reply'], 'in-reply-to': [reply] },
    })
    await postr.jobs.runDue()
    const fake = fakeContext()
    await postrLoader({ postr }).load(fake.context)
    const [entry] = fake.entries.values()
    const data = entry?.data as {
      inReplyTo: string[]
      postType: string
      references: Record<string, { type: string[] }>
    }
    assert.deepEqual(data.inReplyTo, [reply])
    assert.equal(data.postType, 'reply')
    assert.deepEqual(data.references[reply]?.type, ['h-entry'])
  })

  it('throws on a failed build sync, but keeps the store in dev', async () => {
    const postr = testPostr()
    await seed(postr)
    const loader = (onError?: 'throw' | 'warn') =>
      postrLoader({
        endpoint: 'https://example.com/micropub',
        token: 'bad',
        fetch: postrFetch(postr),
        onError,
      })

    await assert.rejects(loader().load(fakeContext().context), /returned 403/)

    const dev = fakeContext({ dev: true })
    await postrLoader({ postr }).load(dev.context)
    await loader().load(dev.context)
    assert.equal(dev.entries.size, 2)
    assert.match(dev.warnings[0] ?? '', /keeping the previous entries.*403/)

    const warned = fakeContext()
    await loader('warn').load(warned.context)
    assert.equal(warned.warnings.length, 1)
  })
})
