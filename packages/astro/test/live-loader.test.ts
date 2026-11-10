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
