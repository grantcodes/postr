#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { importLegacyPosts, type LegacyDoc } from '../legacy-import.ts'
import { createPostr } from '../postr.ts'

const usage = `Usage: postr-import-legacy --dump <dump.json> --site-url <url> [--database <postr.db>]
                          [--media-url <url>] [--permalink-pattern <pattern>] [--dry-run]

Imports a postr 1.x collection.dump() file. Run it with TZ set to the old server's timezone
so permalink dates match. --dry-run imports into memory and only prints the report.`

const { values } = parseArgs({
  options: {
    dump: { type: 'string' },
    database: { type: 'string', default: 'postr.db' },
    'site-url': { type: 'string' },
    'media-url': { type: 'string' },
    'permalink-pattern': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

if (values.help || !values.dump || !values['site-url']) {
  console.log(usage)
  process.exit(values.help ? 0 : 1)
}

let dump: unknown
try {
  dump = JSON.parse(await readFile(values.dump, 'utf8'))
} catch (err) {
  console.error(`Could not read ${values.dump}: ${(err as Error).message}`)
  process.exit(1)
}
const docs = (Array.isArray(dump) ? dump : (dump as { docs?: LegacyDoc[] }).docs) as
  | LegacyDoc[]
  | undefined
if (!Array.isArray(docs)) {
  console.error('The dump must be an array of posts or an object with a "docs" array.')
  process.exit(1)
}

const siteUrl = values['site-url']
const postr = createPostr({
  siteUrl,
  endpointUrl: `${siteUrl.replace(/\/$/, '')}/micropub`,
  database: values['dry-run'] ? ':memory:' : values.database,
  auth: {},
  runJobs: false,
  formatContent: false,
  downloadExternalMedia: false,
})
const report = await importLegacyPosts(postr, docs, {
  siteBaseUrl: siteUrl,
  mediaBaseUrl: values['media-url'],
  permalinkPattern: values['permalink-pattern'],
})
postr.close()

console.log(JSON.stringify(report, null, 2))
process.exit(report.failed.length ? 1 : 0)
