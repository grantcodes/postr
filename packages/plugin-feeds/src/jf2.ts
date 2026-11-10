import type { Mf2Item, Mf2Value } from '@postr/core'

export type Jf2 = { [key: string]: unknown }

const hidden = new Set(['post-status', 'visibility', 'mp-slug', 'syndicate-to'])

function isItem(value: Mf2Value): value is Mf2Value & Mf2Item {
  return (
    typeof value === 'object' && Array.isArray(value.type) && typeof value.properties === 'object'
  )
}

function convertValue(property: string, value: Mf2Value): Mf2Value {
  if (isItem(value)) return mf2ToJf2(value)
  if (typeof value !== 'object') return value
  if (property === 'content') return { html: value.html, text: value.value }
  if (property === 'photo' && typeof value.value === 'string') return value.value
  return value
}

/** Converts mf2 JSON to JF2: https://jf2.spec.indieweb.org/ */
export function mf2ToJf2(item: Mf2Item): Jf2 {
  const jf2: Jf2 = { type: item.type[0]?.replace(/^h-/, '') }
  const url = item.properties.url?.[0]
  if (typeof url === 'string') jf2.uid = url
  for (const [property, values] of Object.entries(item.properties)) {
    if (hidden.has(property)) continue
    const converted = values.map((value) => convertValue(property, value))
    jf2[property] = converted.length === 1 ? converted[0] : converted
  }
  if (item.children) jf2.children = item.children
  return jf2
}
