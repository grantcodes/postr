import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { PostrError } from '../errors.ts'
import type { MediaStore } from '../media.ts'
import type { Mf2Properties, Mf2Update } from '../mf2.ts'
import type { PostTypeDefinition } from '../posts/post-type.ts'
import type { PostService } from '../posts/service.ts'
import { requireScope, type TokenInfo } from './auth.ts'

export interface MicropubDeps {
  posts: PostService
  media?: MediaStore
  authenticate: (token: string | undefined) => Promise<TokenInfo>
  endpointUrl: string
  readOnly?: boolean
  postTypes: () => PostTypeDefinition[]
  syndicateTo: () => Array<{ uid: string; name: string; checked?: boolean }>
  micropubConfig: Record<string, unknown>
}

type Body = Record<string, unknown>

const mediaProperties = new Set(['photo', 'video', 'audio'])

function bearerToken(c: Context, body?: Body): string | undefined {
  const header = c.req.header('authorization')?.trim()
  const fromBody = asArray(body?.access_token)[0]
  // RFC 6750 §2: a request must not use more than one way to send the token.
  if (header && fromBody !== undefined) {
    throw new PostrError(
      'invalid_request',
      'Send the access token in the header or the body, not both'
    )
  }
  if (header) return /^Bearer\s+(\S+)$/i.exec(header)?.[1]
  return typeof fromBody === 'string' ? fromBody : undefined
}

/** Integer query parameter, clamped to `min..max`; anything unparseable gives `fallback`. */
function intParam(value: string | undefined, fallback: number, min: number, max = Infinity) {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) && value ? Math.min(Math.max(n, min), max) : fallback
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Converts a form-encoded or multipart create request into mf2 JSON, saving uploaded files. */
async function formToMf2(form: Record<string, unknown>, media: MediaStore | undefined) {
  const properties: Mf2Properties = {}
  for (const [rawKey, rawValue] of Object.entries(form)) {
    if (rawKey === 'h' || rawKey === 'access_token') continue
    const key = rawKey.replace(/\[\]$/, '')
    for (const value of asArray(rawValue)) {
      let stored: string
      if (value instanceof File) {
        if (!mediaProperties.has(key)) continue
        if (!media) throw new PostrError('invalid_request', 'File uploads are not enabled')
        stored = await media.save({
          data: new Uint8Array(await value.arrayBuffer()),
          name: value.name,
          type: value.type,
        })
      } else {
        stored = String(value)
      }
      ;(properties[key] ??= []).push(stored)
    }
  }
  const h = asArray(form.h)[0]
  return { type: [`h-${typeof h === 'string' ? h : 'entry'}`], properties }
}

export function createMicropubApp(deps: MicropubDeps) {
  const { posts } = deps
  const endpoint = URL.parse(deps.endpointUrl)
  if (!endpoint) throw new TypeError(`Invalid endpointUrl: ${deps.endpointUrl}`)
  const basePath = endpoint.pathname.replace(/\/$/, '')
  const app = new Hono().basePath(basePath)

  app.onError((err, c) => {
    if (err instanceof PostrError) {
      return c.json(
        {
          error: err.code === 'not_found' ? 'invalid_request' : err.code,
          error_description: err.message,
        },
        err.code === 'not_found' ? 400 : (err.status as 400 | 401 | 403)
      )
    }
    console.error('[postr]', err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  })

  function assertWritable() {
    if (deps.readOnly) throw new PostrError('forbidden', 'postr is read-only')
  }

  app.use('/', cors())
  app.use('/media', cors())

  function config() {
    return {
      ...(deps.media ? { 'media-endpoint': `${deps.endpointUrl.replace(/\/$/, '')}/media` } : {}),
      'syndicate-to': deps.syndicateTo(),
      'post-types': deps.postTypes().map(({ type, name }) => ({ type, name })),
      q: ['config', 'source', 'category', 'syndicate-to', 'post-types'],
      ...deps.micropubConfig,
    }
  }

  app.get('/', async (c) => {
    await deps.authenticate(bearerToken(c))
    const q = c.req.query('q')
    if (!q) return c.json({})

    if (q === 'config') return c.json(config())

    if (q === 'category') {
      const search = c.req.query('search')?.trim().toLowerCase()
      const categories = await posts.categories({ includeHidden: true })
      return c.json({
        categories: search
          ? categories.filter((cat) => cat.toLowerCase().includes(search))
          : categories,
      })
    }

    if (q === 'source') {
      const url = c.req.query('url')
      const requested = [
        ...(c.req.queries('properties[]') ?? []),
        ...(c.req.queries('properties') ?? []),
      ]
      if (url) {
        const post = await posts.getByUrl(url)
        if (!post) throw new PostrError('not_found', 'Post not found')
        const item = posts.toMf2(post)
        if (!requested.length) return c.json(item)
        const properties: Mf2Properties = {}
        for (const key of requested) {
          const values = item.properties[key]
          if (values) properties[key] = values
        }
        return c.json({ properties })
      }

      const limit = intParam(c.req.query('limit'), 20, 1, 100)
      const offset = intParam(c.req.query('after'), 0, 0)
      const propertyFilters: Record<string, string> = {}
      for (const [key, value] of Object.entries(c.req.query())) {
        if (key.startsWith('property-')) propertyFilters[key.slice('property-'.length)] = value
      }
      const items = await posts.list({
        limit,
        offset,
        includeHidden: true,
        order: c.req.query('order') === 'reverse' ? 'asc' : 'desc',
        postType: c.req.query('post-type'),
        search: c.req.query('search'),
        exists: [...(c.req.queries('exists') ?? []), ...(c.req.queries('exists[]') ?? [])],
        notExists: [
          ...(c.req.queries('not-exists') ?? []),
          ...(c.req.queries('not-exists[]') ?? []),
        ],
        properties: propertyFilters,
      })
      return c.json({
        items: items.map(posts.toMf2),
        ...(items.length === limit ? { paging: { after: String(offset + limit) } } : {}),
      })
    }

    const value = (config() as Record<string, unknown>)[q]
    if (value !== undefined) return c.json({ [q]: value })
    throw new PostrError('invalid_request', `Unsupported query: ${q}`)
  })

  app.post('/', async (c) => {
    const isJson = (c.req.header('content-type') ?? '').includes('json')
    const body: Body = isJson
      ? await c.req.json().catch(() => {
          throw new PostrError('invalid_request', 'Invalid JSON body')
        })
      : await c.req.parseBody({ all: true })
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new PostrError('invalid_request', 'The body must be an object')
    }
    const token = await deps.authenticate(bearerToken(c, body))
    assertWritable()

    const action = asArray(body.action)[0]
    if (action !== undefined) {
      const url = asArray(body.url)[0]
      if (typeof url !== 'string') throw new PostrError('invalid_request', 'Missing url')
      const scope = typeof action === 'string' ? action : ''
      if (!['update', 'delete', 'undelete'].includes(scope)) {
        throw new PostrError('invalid_request', `Unsupported action: ${scope}`)
      }
      requireScope(
        token,
        scope === 'undelete' && !token.scope.includes('undelete') ? 'create' : scope
      )

      if (action === 'delete') {
        const post = await posts.delete(url)
        return c.json({ location: post.url })
      }
      if (action === 'undelete') {
        const post = await posts.undelete(url)
        return c.json({ location: post.url })
      }
      if (!isJson) throw new PostrError('invalid_request', 'Updates must be sent as JSON')
      const previous = await posts.getByUrl(url, { includeDeleted: true })
      const post = await posts.update(url, body as Mf2Update)
      c.header('Location', post.url)
      return c.json({ location: post.url }, previous && previous.url !== post.url ? 201 : 200)
    }

    requireScope(token, 'create')
    const input = isJson ? body : await formToMf2(body, deps.media)
    const properties = (input as { properties?: unknown }).properties ?? {}
    if (!Object.keys(properties).some((key) => !key.startsWith('mp-'))) {
      throw new PostrError('invalid_request', 'A post needs at least one property')
    }
    const post = await posts.create(input as Parameters<PostService['create']>[0])
    c.header('Location', post.url)
    return c.json({ location: post.url, item: posts.toMf2(post) }, 201)
  })

  app.post('/media', async (c) => {
    const body = await c.req.parseBody()
    requireScope(await deps.authenticate(bearerToken(c, body)), 'media')
    assertWritable()
    if (!deps.media) throw new PostrError('invalid_request', 'Media uploads are not enabled')
    const file = body.file
    if (!(file instanceof File)) throw new PostrError('invalid_request', 'Missing file')
    const url = await deps.media.save({
      data: new Uint8Array(await file.arrayBuffer()),
      name: file.name,
      type: file.type,
    })
    c.header('Location', url)
    return c.json({ location: url }, 201)
  })

  return app
}
