import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { postrLiveLoader } from '../src/index.ts'
import { postrFetch, seed, siteUrl, testPostr } from './helpers.ts'

const collection = 'posts'

describe('postrLiveLoader', () => {
  it('loads filtered, paged collections with a cache hint', async () => {
    const postr = testPostr()
    const { note, article } = await seed(postr)
    const loader = postrLiveLoader({ postr })

    const all = await loader.loadCollection({ collection })
    assert.ok('entries' in all)
    assert.deepEqual(
      all.entries.map((entry) => entry.id),
      [article.path.slice(1), note.path.slice(1)]
    )
    assert.deepEqual(all.cacheHint, { tags: ['postr'], lastModified: new Date(article.updated) })
    assert.equal(all.entries[1]?.rendered?.html, '<p>Hello <strong>world</strong> #indieweb</p>')

    const second = await loader.loadCollection({ collection, filter: { limit: 1, offset: 1 } })
    assert.ok('entries' in second)
    assert.deepEqual(
      second.entries.map((entry) => entry.id),
      [note.path.slice(1)]
    )

    const notes = await loader.loadCollection({ collection, filter: { postType: 'note' } })
    assert.ok('entries' in notes)
    assert.equal(notes.entries.length, 1)

    const found = await loader.loadCollection({ collection, filter: { search: 'artic' } })
    assert.ok('entries' in found)
    assert.deepEqual(
      found.entries.map((entry) => entry.id),
      [article.path.slice(1)]
    )
  })

  it('filters by published date and counts the posts a filter matches', async () => {
    const postr = testPostr()
    const { note, article } = await seed(postr)
    const loader = postrLiveLoader({ postr })
    const published = { from: '2026-01-02', to: new Date('2026-01-03T00:00:00Z') }

    const dated = await loader.loadCollection({ collection, filter: { published } })
    assert.ok('entries' in dated)
    assert.deepEqual(
      dated.entries.map((entry) => entry.id),
      [article.path.slice(1)]
    )
    const before = await loader.loadCollection({
      collection,
      filter: { published: { to: '2026-01-02' } },
    })
    assert.ok('entries' in before)
    assert.deepEqual(
      before.entries.map((entry) => entry.id),
      [note.path.slice(1)]
    )

    assert.equal(await loader.count(), 2)
    assert.equal(await loader.count({ published }), 1)
    assert.equal(await loader.count({ postType: 'note' }), 1)
    assert.equal(await postrLiveLoader({ postr, postType: 'note' }).count(), 1)
    assert.equal(await postrLiveLoader({ postr, visibility: ['public', 'unlisted'] }).count(), 3)
    assert.equal(await postrLiveLoader({ postr, drafts: true }).count(), 3)
  })

  it('pages through visible posts with offsets', async () => {
    const postr = testPostr()
    await seed(postr)
    for (let i = 0; i < 5; i++) {
      await postr.posts.create({
        type: ['h-entry'],
        properties: { content: [`Post ${i}`], published: [`2025-01-0${i + 1}T00:00:00Z`] },
      })
    }
    const loader = postrLiveLoader({ postr, visibility: ['public', 'unlisted'] })
    const texts = async (limit: number, offset: number) => {
      const page = await loader.loadCollection({ collection, filter: { limit, offset } })
      assert.ok('entries' in page)
      return page.entries.map((entry) => entry.data.content?.text)
    }
    assert.equal(await loader.count(), 8)
    assert.deepEqual(await texts(2, 3), ['Post 4', 'Post 3'])
    assert.deepEqual(await texts(3, 7), ['Post 0'])
  })

  it('loads one entry by id or url, hiding missing and filtered posts', async () => {
    const postr = testPostr()
    const { note, unlisted } = await seed(postr)
    const loader = postrLiveLoader({ postr })

    const byId = await loader.loadEntry({ collection, filter: { id: note.path.slice(1) } })
    assert.ok(byId && 'data' in byId)
    assert.equal(byId.data.url, note.url)
    assert.deepEqual(byId.cacheHint, {
      tags: ['postr', `postr:${note.path.slice(1)}`],
      lastModified: new Date(note.updated),
    })

    const byUrl = await loader.loadEntry({ collection, filter: { url: note.url } })
    assert.ok(byUrl && 'id' in byUrl)
    assert.equal(byUrl.id, note.path.slice(1))

    assert.equal(await loader.loadEntry({ collection, filter: { id: 'nope' } }), undefined)
    assert.equal(await loader.loadEntry({ collection, filter: { url: unlisted.url } }), undefined)
    const withUnlisted = postrLiveLoader({ postr, visibility: ['public', 'unlisted'] })
    assert.ok(await withUnlisted.loadEntry({ collection, filter: { url: unlisted.url } }))
  })

  it('returns source failures as errors', async () => {
    const postr = testPostr()
    const loader = postrLiveLoader({
      endpoint: `${siteUrl}/micropub`,
      token: 'bad',
      fetch: postrFetch(postr),
    })
    const list = await loader.loadCollection({ collection })
    assert.ok('error' in list)
    assert.match(list.error.message, /returned 403/)
    const entry = await loader.loadEntry({ collection, filter: { id: 'x' } })
    assert.ok(entry && 'error' in entry)
  })
})
