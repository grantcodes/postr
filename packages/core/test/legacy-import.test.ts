import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import { importLegacyPosts, type LegacyDoc } from '../src/index.ts'
import { siteUrl, tempDir, testPostr } from './helpers.ts'

const docs: LegacyDoc[] = [
  {
    _id: 'legacy-1',
    type: ['h-entry'],
    properties: {
      content: [{ value: 'Hello', html: '<p>Hello</p>' }],
      photo: [{ value: '{{mediaBaseUrl}}/2019/05/01/a.jpg', alt: '' }],
      'mp-slug': ['hello'],
      published: ['2019-05-01T12:00:00.000Z'],
      updated: ['2019-05-02T12:00:00.000Z'],
      visibility: ['visible'],
      'post-status': ['published'],
      comment: [{ type: ['h-cite'], properties: { url: ['https://them.example/r'] } }],
    },
  },
  {
    _id: 'legacy-2',
    type: ['h-entry'],
    properties: {
      name: ['Gone'],
      'mp-slug': ['gone'],
      published: ['2019-06-01T12:00:00.000Z'],
      'post-status': ['deleted'],
    },
  },
  { _id: 'legacy-3', type: ['h-entry'], properties: { published: ['nope'] } },
]

describe('importLegacyPosts', () => {
  it('keeps ids, permalinks, dates and mentions without side effects', async () => {
    const sent: string[] = []
    const postr = testPostr({
      fetch: (async (input: string | URL) => {
        sent.push(String(input))
        return new Response('')
      }) as typeof fetch,
    })
    const report = await importLegacyPosts(postr, docs, {
      siteBaseUrl: `${siteUrl}/`,
      mediaBaseUrl: 'https://media.example.com',
    })

    assert.equal(report.imported, 2)
    assert.equal(report.deleted, 1)
    assert.deepEqual(
      report.failed.map((f) => f.id),
      ['legacy-3']
    )

    const post = await postr.posts.getByUrl(`${siteUrl}/2019/05/01/hello`)
    assert.equal(post?.id, 'legacy-1')
    assert.equal(post?.updated, '2019-05-02T12:00:00.000Z')
    assert.equal(post?.visibility, 'public')
    assert.deepEqual(post?.properties.photo, [
      { value: 'https://media.example.com/2019/05/01/a.jpg', alt: '' },
    ])
    assert.equal(post?.properties.comment?.length, 1)

    assert.equal(await postr.posts.getByUrl(`${siteUrl}/2019/06/01/gone`), undefined)
    assert.ok((await postr.posts.get('legacy-2'))?.deletedAt)

    await postr.jobs.runDue()
    assert.deepEqual(sent, [])
  })

  it('keeps 1.x permalinks from stored urls and created dates, and cleans 1.x data', async () => {
    const postr = testPostr()
    const entry = (id: string, properties: LegacyDoc['properties']): LegacyDoc => ({
      _id: id,
      type: ['h-entry'],
      properties: { published: ['2019-08-28T10:00:00Z'], ...properties },
    })
    const report = await importLegacyPosts(
      postr,
      [
        entry('deleted-twin', { 'mp-slug': ['twin'], 'post-status': ['deleted'] }),
        entry('created', { 'mp-slug': ['watched'], created: ['2014-05-22T10:00:00Z'] }),
        entry('stored-url', {
          'mp-slug': ['moved'],
          url: ['{{siteBaseUrl}}/2015/01/02/moved'],
        }),
        entry('nulls', {
          'mp-slug': ['nulls'],
          'mp-syndicate-to': ['superfeedr', null as unknown as string],
          category: ['a', null as unknown as string],
        }),
        entry('twin', { 'mp-slug': ['twin'] }),
        {
          ...entry('liked', { 'mp-slug': ['liked'], 'like-of': ['https://them.example/post'] }),
          cms: {
            references: [
              {
                type: ['h-entry'],
                properties: { url: ['https://them.example/post'], name: ['Theirs'] },
              },
            ],
          },
        },
      ],
      { siteBaseUrl: siteUrl, createdDateInPermalinks: true }
    )

    assert.deepEqual(report.failed, [])
    assert.deepEqual(report.skipped, [{ id: 'deleted-twin', path: '/2019/08/28/twin' }])
    const path = async (id: string) => (await postr.posts.get(id))?.path
    assert.equal(await path('created'), '/2014/05/22/watched')
    assert.equal((await postr.posts.get('created'))?.published, '2019-08-28T10:00:00Z')
    assert.equal(await path('stored-url'), '/2015/01/02/moved')
    assert.equal(await path('twin'), '/2019/08/28/twin')
    const liked = await postr.posts.get('liked')
    assert.equal(liked?.updated, '2019-08-28T10:00:00Z')
    assert.ok(liked)
    assert.deepEqual(
      (await postr.posts.references(liked))['https://them.example/post']?.properties.name,
      ['Theirs']
    )
    assert.deepEqual((await postr.posts.get('nulls'))?.properties.category, ['a'])
  })

  it('runs as a CLI with --dry-run', async () => {
    const dir = await tempDir()
    const dump = join(dir, 'dump.json')
    await writeFile(dump, JSON.stringify({ docs }))
    const cli = new URL('../src/bin/import-legacy.ts', import.meta.url).pathname
    const result = await promisify(execFile)(process.execPath, [
      cli,
      '--dump',
      dump,
      '--site-url',
      siteUrl,
      '--dry-run',
    ]).catch((err: { stdout: string; code: number }) => err)
    assert.equal('code' in result ? result.code : 0, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.imported, 2)
    assert.equal(report.failed.length, 1)
  })
})
