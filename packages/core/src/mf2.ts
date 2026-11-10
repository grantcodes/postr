import * as z from 'zod'

export interface Mf2Object {
  [key: string]: unknown
}

export type Mf2Value = string | number | boolean | Mf2Object

export type Mf2Properties = Record<string, Mf2Value[]>

export interface Mf2Item extends Mf2Object {
  type: string[]
  properties: Mf2Properties
  children?: Array<string | Mf2Item>
}

const mf2Value = z.union([z.string(), z.number(), z.boolean(), z.looseObject({})])

const mf2PropertiesSchema = z.record(z.string(), z.array(mf2Value))

/** Micropub create payload in mf2 JSON shape. */
export const mf2InputSchema = z.object({
  type: z.array(z.string().startsWith('h-')).min(1),
  properties: mf2PropertiesSchema,
  children: z.array(z.string()).optional(),
})

export type Mf2Input = z.infer<typeof mf2InputSchema>

/** Micropub update payload. */
export const mf2UpdateSchema = z.object({
  replace: mf2PropertiesSchema.optional(),
  add: mf2PropertiesSchema.optional(),
  delete: z.union([z.array(z.string()), mf2PropertiesSchema]).optional(),
})

export type Mf2Update = z.infer<typeof mf2UpdateSchema>

/** First value of a property as a string, reading `value`/`html` from objects. */
export function firstString(properties: Mf2Properties, key: string): string | undefined {
  const value = properties[key]?.[0]
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if (typeof value.value === 'string') return value.value
    if (typeof value.html === 'string') return value.html
  }
  return undefined
}

/** All values of a property that can be read as URLs. */
export function urlValues(properties: Mf2Properties, key: string): string[] {
  const urls: string[] = []
  for (const value of properties[key] ?? []) {
    let url: unknown = value
    if (value && typeof value === 'object') {
      const nested = value.properties as Mf2Properties | undefined
      url = value.value ?? (nested ? firstString(nested, 'url') : undefined)
    }
    if (typeof url === 'string' && URL.canParse(url)) urls.push(url)
  }
  return urls
}
