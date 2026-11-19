import { marked } from 'marked'
import { parseHTML } from 'linkedom'
import type { Mf2Properties, Mf2Value } from '../mf2.ts'

export function htmlToText(html: string): string {
  const { document } = parseHTML(`<html><body>${html}</body></html>`)
  return (document.body.textContent ?? '').trim()
}

function markdownToHtml(markdown: string): string {
  return (marked.parse(markdown, { async: false }) as string).trim()
}

// A `#` that starts the text or follows whitespace or opening punctuation, so URL
// fragments (`/#delete`) and glued text (`night.#10`) are skipped; tags need a letter.
const hashtag = /(?<=^|[\s\p{Ps}\p{Pi}"'])#(?=[\p{L}\p{M}\p{N}_]*\p{L})([\p{L}\p{M}\p{N}_]{2,})/gu

function formatValue(content: Mf2Value): Mf2Value {
  if (typeof content === 'string') {
    const html = markdownToHtml(content)
    return { html, value: htmlToText(html) }
  }
  if (typeof content !== 'object') return content
  const { html, value } = content
  if (typeof html === 'string' && typeof value !== 'string') {
    return { ...content, value: htmlToText(html) }
  }
  if (typeof value === 'string' && typeof html !== 'string') {
    return { ...content, html: markdownToHtml(value) }
  }
  return content
}

/**
 * Converts plain/markdown content to `{ html, value }` and adds `#hashtags` from
 * the text to `category`.
 */
export function formatContent(properties: Mf2Properties): Mf2Properties {
  const content = properties.content
  if (!content?.length) return properties

  const formatted = content.map(formatValue)
  const tags = new Set(properties.category?.filter((c) => typeof c === 'string'))
  const before = tags.size
  for (const item of formatted) {
    if (item && typeof item === 'object' && typeof item.value === 'string') {
      for (const [, tag] of item.value.matchAll(hashtag)) if (tag) tags.add(tag)
    }
  }

  const result: Mf2Properties = { ...properties, content: formatted }
  if (tags.size > before) {
    const objects = properties.category?.filter((c) => typeof c !== 'string') ?? []
    result.category = [...tags, ...objects]
  }
  return result
}
