import { sql } from 'drizzle-orm'
import type { Mf2Properties } from '../mf2.ts'
import { contentValue } from './view.ts'

const strings = (properties: Mf2Properties, key: string) =>
  (properties[key] ?? []).filter((v) => typeof v === 'string').join(' ')

/** Text indexed in `posts_fts` (created in the init migration). */
export function searchFields(properties: Mf2Properties) {
  const content = (properties.content ?? [])
    .map((value) => contentValue(value)?.text)
    .filter(Boolean)
    .join(' ')
  return {
    name: strings(properties, 'name'),
    summary: strings(properties, 'summary'),
    content,
    category: strings(properties, 'category'),
  }
}

/**
 * Turns free text into an FTS5 query: every word must match, as a prefix, so user input
 * can never be read as FTS5 syntax.
 */
export function toMatchQuery(search: string): string | undefined {
  const words = search.match(/[\p{L}\p{N}_]+/gu)
  return words?.map((word) => `"${word}"*`).join(' ')
}

export const ftsTable = sql.identifier('posts_fts')
