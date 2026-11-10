import { createHash } from 'node:crypto'
import { createPostr, type PostrOptions } from '@postr/core'
import type { LoaderContext } from 'astro/loaders'
import { postSchema } from '../src/index.ts'

export const siteUrl = 'https://example.com'
export const endpointUrl = 'https://example.com/micropub'
export const token = 'test-token'

export function testPostr(options: Partial<PostrOptions> = {}) {
  return createPostr({
    siteUrl,
    endpointUrl,
    database: ':memory:',
    auth: { dangerousToken: token },
    runJobs: false,
    fetch: async () => new Response('Not found', { status: 404 }),
    logger: { info() {}, warn() {}, error() {} },
    ...options,
  })
}

/** Creates the usual mix of public, hidden and deleted posts. */
export async function seed(postr: ReturnType<typeof testPostr>) {
  const create = (properties: Record<string, unknown[]>) =>
    postr.posts.create({ type: ['h-entry'], properties: properties as never })
  const note = await create({
    content: ['Hello **world** #indieweb'],
    published: ['2026-01-01T10:00:00Z'],
    'mp-slug': ['hello'],
  })
  const article = await create({
    name: ['An article'],
    content: ['Body text'],
    category: ['news', { type: ['h-card'], properties: { name: ['Someone'] } }],
    photo: [{ value: 'https://example.com/media/a.jpg', alt: 'A photo' }],
    published: ['2026-01-02T10:00:00Z'],
  })
  const draft = await create({ content: ['draft'], 'post-status': ['draft'] })
  const unlisted = await create({ content: ['unlisted'], visibility: ['unlisted'] })
  const hidden = await create({ content: ['private'], visibility: ['private'] })
  const deleted = await create({ content: ['deleted'] })
  await postr.posts.delete(deleted.id)
  return { note, article, draft, unlisted, hidden, deleted }
}

/** A fetch that answers with `postr.fetch`, recording request URLs. */
export function postrFetch(postr: ReturnType<typeof testPostr>) {
  const urls: string[] = []
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    urls.push(request.url)
    return postr.fetch(request)
  }
  return Object.assign(fn as typeof fetch, { urls })
}

/** A minimal Astro LoaderContext with a Map-backed store. */
export function fakeContext({ dev = false } = {}) {
  const entries = new Map<string, { id: string; data: unknown; digest?: string | number }>()
  const warnings: string[] = []
  let parsed = 0
  const store = {
    get: (id: string) => entries.get(id),
    set(entry: { id: string; data: unknown; digest?: string | number }) {
      const existing = entries.get(entry.id)
      if (existing?.digest !== undefined && existing.digest === entry.digest) return false
      entries.set(entry.id, entry)
      return true
    },
    delete: (id: string) => void entries.delete(id),
    has: (id: string) => entries.has(id),
    keys: () => [...entries.keys()],
    values: () => [...entries.values()],
    entries: () => [...entries.entries()],
    clear: () => entries.clear(),
  }
  const context = {
    collection: 'posts',
    store,
    meta: { get() {}, set() {}, has: () => false, delete() {} },
    logger: { info() {}, warn: (message: string) => warnings.push(message), error() {} },
    parseData: async ({ data }: { data: unknown }) => {
      parsed++
      return postSchema.parseAsync(data)
    },
    generateDigest: (data: unknown) =>
      createHash('sha1').update(JSON.stringify(data)).digest('hex'),
    ...(dev && { watcher: {} }),
  } as unknown as LoaderContext
  return {
    context,
    entries,
    warnings,
    get parsed() {
      return parsed
    },
  }
}
