import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPostr, type PostrOptions } from '../src/index.ts'

export const siteUrl = 'https://example.com'
export const endpointUrl = 'https://example.com/micropub'

export type Routes = Record<string, (request: Request) => Response | Promise<Response>>

/** A fetch stub that answers from a URL → handler map and records every request. */
export function fakeFetch(routes: Routes = {}) {
  const requests: Request[] = []
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    const handler = routes[request.url]
    if (!handler) return new Response('Not found', { status: 404 })
    const response = await handler(request)
    Object.defineProperty(response, 'url', { value: request.url })
    return response
  }
  return Object.assign(fn as typeof fetch, { requests })
}

export async function tempDir() {
  return mkdtemp(join(tmpdir(), 'postr-test-'))
}

export function testPostr(options: Partial<PostrOptions> = {}) {
  return createPostr({
    siteUrl,
    endpointUrl,
    database: ':memory:',
    auth: { dangerousToken: 'test-token' },
    runJobs: false,
    fetch: fakeFetch(),
    logger: { info() {}, warn() {}, error() {} },
    ...options,
  })
}

export function micropub(
  postr: ReturnType<typeof testPostr>,
  path: string,
  init: RequestInit & { token?: string | null } = {},
) {
  const headers = new Headers(init.headers)
  const token = init.token === undefined ? 'test-token' : init.token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return postr.fetch(new Request(`${endpointUrl}${path}`, { ...init, headers }))
}

export function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
