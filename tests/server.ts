import { mkdirSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createPostr } from '../packages/core/src/index.ts'
import { feeds } from '../packages/plugin-feeds/src/index.ts'
import { webmentionEndpoint } from '../packages/plugin-webmention-endpoint/src/index.ts'

const port = Number(process.env.PORT) || 3000
const origin = `http://localhost:${port}`
const dir = new URL('./_tmp/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })

const postr = createPostr({
  siteUrl: origin,
  endpointUrl: `${origin}/micropub`,
  database: `${dir}postr.db`,
  media: { dir: `${dir}media`, url: `${origin}/media`, imageSizes: { thumbnail: [200, 200] } },
  auth: { dangerousToken: 'token', dangerousAllowAll: true },
  sendWebmentions: false,
  plugins: [feeds({ author: { name: 'Test Author' } }), webmentionEndpoint()],
})

if (!(await postr.posts.list({ limit: 1 })).length) {
  console.log('Inserting example posts')
  await postr.posts.create({ type: ['h-entry'], properties: { content: ['This is a note'] } })
  await postr.posts.create({
    type: ['h-entry'],
    properties: {
      name: ['Article title'],
      content: [{ html: '<p><strong>This</strong> is an article.</p>' }],
    },
  })
}

const app = new Hono()
app.use('/media/*', serveStatic({ root: dir }))
app.route('/', postr.app)

serve({ fetch: app.fetch, port })
console.log(`Postr test server listening at ${origin}/micropub`)
