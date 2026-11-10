import { mf2 } from 'microformats-parser'

function linkHeaderEndpoint(header: string | null, base: string): string | undefined {
  for (const part of header?.split(',') ?? []) {
    const match = /<([^>]*)>\s*;(.*)/.exec(part)
    if (match?.[2] && /rel\s*=\s*"?([^"]*\s)?webmention(\s[^"]*)?"?/i.test(match[2])) {
      return new URL(match[1] ?? '', base).href
    }
  }
  return undefined
}

/** Webmention endpoint discovery: https://www.w3.org/TR/webmention/#sender-discovers-receiver-webmention-endpoint */
export async function discoverEndpoint(target: string, fetchFn: typeof fetch = fetch) {
  const response = await fetchFn(target, { redirect: 'follow' })
  const base = response.url || target
  const fromHeader = linkHeaderEndpoint(response.headers.get('link'), base)
  if (fromHeader) {
    await response.body?.cancel()
    return fromHeader
  }
  if (!(response.headers.get('content-type') ?? '').includes('html')) {
    await response.body?.cancel()
    return undefined
  }
  const { rels } = mf2(await response.text(), { baseUrl: base })
  const endpoint = rels.webmention?.[0]
  return endpoint === undefined ? undefined : new URL(endpoint, base).href
}

/** Sends a webmention. Returns false when the target has no endpoint; throws when sending fails. */
export async function sendWebmention(
  source: string,
  target: string,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const endpoint = await discoverEndpoint(target, fetchFn)
  if (!endpoint) return false
  const response = await fetchFn(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ source, target }),
  })
  await response.body?.cancel()
  if (!response.ok) {
    throw new Error(`Webmention to ${endpoint} failed with ${response.status}`)
  }
  return true
}
