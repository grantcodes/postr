import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { build } from 'astro'
import { seed, testPostr } from './helpers.ts'

describe('astro build', () => {
  it('builds index, post and category pages from a postr database', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'postr-astro-'))
    const database = join(dir, 'postr.db')
    const postr = testPostr({ database })
    const { note, article, unlisted } = await seed(postr)
    postr.close()

    process.env.POSTR_FIXTURE_DB = database
    await build({
      root: fileURLToPath(new URL('./fixture/', import.meta.url)),
      outDir: join(dir, 'dist'),
      cacheDir: join(dir, 'cache'),
      logLevel: 'error',
    })
    const page = (path: string) => readFile(join(dir, 'dist', path, 'index.html'), 'utf8')

    const index = await page('.')
    assert.ok(index.indexOf(article.path) < index.indexOf(note.path))
    assert.ok(!index.includes(unlisted.path))

    const post = await page(note.path)
    assert.match(post, /<p>Hello <strong>world<\/strong> #indieweb<\/p>/)
    assert.match(post, /2026-01-01T10:00:00.000Z/)
    assert.match(await page(article.path), /<h1>An article<\/h1>/)
    assert.ok((await page('category/news')).includes(article.path))
  })
})
