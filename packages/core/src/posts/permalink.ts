import slugify from '@sindresorhus/slugify'
import { firstString, type Mf2Properties } from '../mf2.ts'

/** Builds `/2026/06/04/my-slug` from a pattern, using the date as written in `published`. */
export function buildPath(pattern: string, published: string, slug: string) {
  const [year, month, day] = published.slice(0, 10).split('-')
  return pattern
    .replace(':year', year ?? '')
    .replace(':month', month ?? '')
    .replace(':day', day ?? '')
    .replace(':slug', slug)
}

export function generateSlug(properties: Mf2Properties, now: Date): string {
  let text =
    firstString(properties, 'name') ??
    firstString(properties, 'summary') ??
    firstString(properties, 'content')
  if (text && text.length > 50) {
    text = text.slice(0, 50)
    const lastSpace = text.lastIndexOf(' ')
    if (lastSpace > 0) text = text.slice(0, lastSpace)
  }
  const slug = text ? slugify(text) : ''
  if (slug) return slug
  const time = [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
  return time.map((n) => String(n).padStart(2, '0')).join('-')
}
