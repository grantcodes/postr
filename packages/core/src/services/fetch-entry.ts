import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { mf2 } from 'microformats-parser'
import type { Mf2Item, Mf2Properties } from '../mf2.ts'

/** Failed fetch, keeping the HTTP status so callers can react to e.g. `410 Gone`. */
export class FetchError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'FetchError'
    this.status = status
  }
}

function findEntry(items: Mf2Item[]): Mf2Item | undefined {
  for (const item of items) {
    if (item.type.includes('h-entry')) return item
    const child = item.children && findEntry(item.children.filter((c) => typeof c !== 'string'))
    if (child) return child
  }
  return undefined
}

function extractArticle(html: string, url: string): Mf2Item {
  const { document } = parseHTML(html)
  const properties: Mf2Properties = { url: [url] }
  // SAFETY: linkedom implements the DOM subset Readability reads; its types are not the lib.dom ones.
  const dom = document as unknown as ConstructorParameters<typeof Readability>[0]
  const article = new Readability(dom).parse()
  const image = document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content')

  if (article?.title) properties.name = [article.title]
  if (article?.excerpt) properties.summary = [article.excerpt]
  if (article?.content) {
    properties.content = [{ html: article.content, value: article.textContent ?? '' }]
  }
  if (article?.byline) {
    properties.author = [{ type: ['h-card'], properties: { name: [article.byline] } }]
  }
  if (article?.publishedTime && !Number.isNaN(Date.parse(article.publishedTime))) {
    properties.published = [new Date(article.publishedTime).toISOString()]
  }
  if (image && URL.canParse(image, url)) properties.featured = [new URL(image, url).href]
  return { type: ['h-entry'], properties }
}

/**
 * Fetches a URL as an h-entry: the page's own microformats when it has them,
 * otherwise an article extracted with Readability. Media URLs become photo/audio/video entries.
 */
export async function fetchEntry(url: string, fetchFn: typeof fetch = fetch): Promise<Mf2Item> {
  const response = await fetchFn(url, {
    headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new FetchError(response.status, `Fetching ${url} failed with ${response.status}`)
  }

  const mime = response.headers.get('content-type') ?? ''
  for (const [prefix, property] of [
    ['image/', 'photo'],
    ['audio/', 'audio'],
    ['video/', 'video'],
  ] as const) {
    if (mime.startsWith(prefix)) {
      await response.body?.cancel()
      return { type: ['h-entry'], properties: { url: [url], [property]: [url] } }
    }
  }

  const html = await response.text()
  const parsed = mf2(html, { baseUrl: response.url || url })
  const entry = findEntry(parsed.items as Mf2Item[])
  if (entry && Object.keys(entry.properties).length > 1) {
    entry.properties.url ??= [url]
    return entry
  }
  return extractArticle(html, url)
}
