/**
 * Property-based tests for the mf2 storage round trip and Micropub update semantics,
 * checked against a small reference model.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import type { Mf2Properties, Mf2Update, Mf2Value } from '../src/index.ts'
import { testPostr } from './helpers.ts'

// Keys that are stored as-is (no column, link, media or content handling).
const key = fc.constantFrom('category', 'name', 'summary', 'location', 'x-one', 'x-two')

// A small pool so values repeat and `delete` has something to match.
const value: fc.Arbitrary<Mf2Value> = fc.oneof(
  fc.constantFrom('a', 'b', 'c', 'ü', '#tag', ''),
  fc.integer({ min: -5, max: 5 }),
  fc.boolean(),
  fc.record({ value: fc.constantFrom('a', 'b') }),
  fc.record({
    type: fc.constant(['h-card']),
    properties: fc.record({
      name: fc.array(fc.constantFrom('x', 'y'), { minLength: 1, maxLength: 2 }),
    }),
  })
)

const properties: fc.Arbitrary<Mf2Properties> = fc.dictionary(
  key,
  fc.array(value, { minLength: 1, maxLength: 4 }),
  {
    maxKeys: 4,
  }
)

const update: fc.Arbitrary<Mf2Update> = fc.record(
  {
    replace: properties,
    add: fc.dictionary(key, fc.array(value, { minLength: 1, maxLength: 3 }), { maxKeys: 3 }),
    delete: fc.oneof(
      fc.uniqueArray(key, { maxLength: 3 }),
      fc.dictionary(key, fc.array(value, { maxLength: 3 }), { maxKeys: 3 })
    ),
  },
  { requiredKeys: [] }
)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Reference semantics: replace, then delete, then add; empty properties disappear. */
function applyModel(current: Mf2Properties, change: Mf2Update): Mf2Properties {
  const result: Mf2Properties = structuredClone(current)
  for (const [k, values] of Object.entries(change.replace ?? {})) result[k] = values
  if (Array.isArray(change.delete)) {
    for (const k of change.delete) delete result[k]
  } else {
    for (const [k, values] of Object.entries(change.delete ?? {})) {
      if (result[k]) result[k] = result[k].filter((v) => !values.some((d) => same(d, v)))
    }
  }
  for (const [k, values] of Object.entries(change.add ?? {}))
    result[k] = [...(result[k] ?? []), ...values]
  for (const [k, values] of Object.entries(result)) if (!values.length) delete result[k]
  return result
}

/** Plain JSON with sorted keys (fast-check builds null-prototype objects). */
const sorted = (props: Mf2Properties): unknown =>
  JSON.parse(
    JSON.stringify(Object.fromEntries(Object.entries(props).sort(([a], [b]) => a.localeCompare(b))))
  )

describe('properties', () => {
  const postr = testPostr({ formatContent: false, downloadExternalMedia: false })

  it('stores arbitrary mf2 properties unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(properties, async (input) => {
        const post = await postr.posts.create({ type: ['h-entry'], properties: input })
        const stored = await postr.posts.get(post.id)
        assert.deepEqual(sorted(stored?.properties ?? {}), sorted(input))
      })
    )
  })

  it('applies any sequence of Micropub updates like the reference model', async () => {
    await fc.assert(
      fc.asyncProperty(
        properties,
        fc.array(update, { minLength: 1, maxLength: 5 }),
        async (initial, changes) => {
          const post = await postr.posts.create({ type: ['h-entry'], properties: initial })
          let expected = initial
          for (const change of changes) {
            await postr.posts.update(post.id, change)
            expected = applyModel(expected, change)
          }
          const stored = await postr.posts.get(post.id)
          assert.deepEqual(sorted(stored?.properties ?? {}), sorted(expected))
        }
      )
    )
  })

  it('re-creating a post from its mf2 export reproduces it', async () => {
    const published = fc
      .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
      .map((d) => d.toISOString())
    await fc.assert(
      fc.asyncProperty(
        properties,
        published,
        fc.constantFrom('published', 'draft'),
        fc.constantFrom('public', 'unlisted', 'private'),
        async (input, date, status, visibility) => {
          const post = await postr.posts.create({
            type: ['h-entry'],
            properties: {
              ...input,
              published: [date],
              'post-status': [status],
              visibility: [visibility],
            },
          })
          const { children: _, ...item } = postr.posts.toMf2(post)
          const copy = await testPostr({ formatContent: false }).posts.create(item)
          assert.deepEqual(sorted(copy.properties), sorted(post.properties))
          // The slug (and so the path) is identity, not content, so it is not compared.
          assert.deepEqual(
            [copy.published, copy.updated, copy.status, copy.visibility],
            [post.published, post.updated, post.status, post.visibility]
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})
