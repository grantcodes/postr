import { PostrError } from '../errors.ts'

export interface TokenInfo {
  me: string
  scope: string[]
  clientId?: string
}

export interface AuthOptions {
  /** IndieAuth token endpoint used to verify bearer tokens. */
  tokenEndpoint?: string
  /** Custom verification, e.g. token introspection. Return `null` for an invalid token. */
  verify?: (token: string) => Promise<TokenInfo | null>
  /** A fixed token accepted with every scope. Development and tests only. */
  dangerousToken?: string
  /** Accept every request, with or without a token. Development only. */
  dangerousAllowAll?: boolean
}

const allScopes = ['create', 'update', 'delete', 'undelete', 'media']

function sameSite(a: string, b: string) {
  const normalize = (url: string) => URL.parse(url)?.href.replace(/\/$/, '')
  const site = normalize(b)
  return site !== undefined && normalize(a) === site
}

async function verifyWithTokenEndpoint(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<TokenInfo | null> {
  const response = await fetchFn(endpoint, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!response.ok) return null
  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = (response.headers.get('content-type') ?? '').includes('json')
      ? JSON.parse(text)
      : Object.fromEntries(new URLSearchParams(text))
  } catch {
    return null
  }
  if (typeof data.me !== 'string' || typeof data.scope !== 'string') return null
  return {
    me: data.me,
    scope: data.scope.split(/\s+/).filter(Boolean),
    clientId: typeof data.client_id === 'string' ? data.client_id : undefined,
  }
}

export function createAuthenticator(options: AuthOptions, siteUrl: string, fetchFn: typeof fetch) {
  return async (token: string | undefined): Promise<TokenInfo> => {
    const full = { me: siteUrl, scope: allScopes, clientId: 'dangerous' }
    if (options.dangerousAllowAll) return full
    if (!token) {
      throw new PostrError(
        'unauthorized',
        'Missing "Authorization" header or "access_token" parameter',
      )
    }
    if (options.dangerousToken && token === options.dangerousToken) return full

    let info: TokenInfo | null = null
    if (options.verify) info = await options.verify(token)
    else if (options.tokenEndpoint) {
      info = await verifyWithTokenEndpoint(options.tokenEndpoint, token, fetchFn)
    }
    if (!info) throw new PostrError('forbidden', 'Invalid access token')
    if (!sameSite(info.me, siteUrl)) {
      throw new PostrError('forbidden', 'The token is not for this site')
    }
    return info
  }
}

/** `create` and the older `post` scope are interchangeable. */
export function requireScope(token: TokenInfo, scope: string) {
  const scopes = new Set(token.scope)
  if (scopes.has('post')) scopes.add('create')
  if (scopes.has('create')) scopes.add('media')
  if (!scopes.has(scope)) {
    throw new PostrError('insufficient_scope', `The token does not have the ${scope} scope`)
  }
}
