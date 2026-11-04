/**
 * The webmention.rocks sender discovery tests (https://webmention.rocks/), run locally against
 * stubbed pages. Numbers match the site's tests; each page's real endpoint ends in
 * `/webmention` and decoys end in `/error`.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { discoverEndpoint, sendWebmention } from '../../src/index.ts'
import { fakeFetch } from '../helpers.ts'

const base = 'https://webmention.rocks/'

interface DiscoveryCase {
  name: string
  link?: string | string[]
  linkHeaderName?: string
  html?: string
  /** Defaults to `${base}test/<n>/webmention`. */
  expected?: string
}

const cases: Record<number, DiscoveryCase> = {
  1: {
    name: 'Link header, unquoted rel, relative URL',
    link: '</test/1/webmention>; rel=webmention',
  },
  2: {
    name: 'Link header, unquoted rel, absolute URL',
    link: `<${base}test/2/webmention>; rel=webmention`,
  },
  3: { name: '<link>, relative URL', html: '<link rel="webmention" href="/test/3/webmention">' },
  4: {
    name: '<link>, absolute URL',
    html: `<link href="${base}test/4/webmention" rel="webmention">`,
  },
  5: {
    name: '<a>, relative URL',
    html: '<a rel="webmention" href="/test/5/webmention">endpoint</a>',
  },
  6: {
    name: '<a>, absolute URL',
    html: `<a href="${base}test/6/webmention" rel="webmention">endpoint</a>`,
  },
  7: {
    name: 'Link header with strange casing',
    link: `<${base}test/7/webmention>; rel=webmention`,
    linkHeaderName: 'LinK',
  },
  8: { name: 'Link header, quoted rel', link: `<${base}test/8/webmention>; rel="webmention"` },
  9: {
    name: 'Multiple rel values on a <link>',
    html: `<link rel="webmention somethingelse" href="${base}test/9/webmention">`,
  },
  10: {
    name: 'Multiple rel values on a Link header',
    link: `<${base}test/10/webmention>; rel="webmention somethingelse"`,
  },
  11: {
    name: 'Link header wins over <link> and <a>',
    link: '</test/11/webmention>; rel="webmention"',
    html: '<link rel="webmention" href="/test/11/webmention/error"><a href="/test/11/webmention/error" rel="webmention">a</a>',
  },
  12: {
    name: 'Exact match of rel=webmention',
    html: '<link rel="not-webmention" href="/test/12/webmention/error"><a href="/test/12/webmention" rel="webmention">ok</a>',
  },
  13: {
    name: 'False endpoint inside an HTML comment',
    html: '<!-- <a href="/test/13/webmention/error" rel="webmention"></a> --><a href="/test/13/webmention" rel="webmention">ok</a>',
  },
  14: {
    name: 'False endpoint in escaped HTML',
    html: '<code>&lt;a href="/test/14/webmention/error" rel="webmention"&gt;&lt;/a&gt;</code><a href="/test/14/webmention" rel="webmention">ok</a>',
  },
  15: {
    name: 'Empty href is the page itself',
    html: '<link rel="webmention" href="">',
    expected: `${base}test/15`,
  },
  16: {
    name: 'First of <a> then <link>',
    html: '<a href="/test/16/webmention" rel="webmention">a</a><link rel="webmention" href="/test/16/webmention/error">',
  },
  17: {
    name: 'First of <link> then <a>',
    html: '<link rel="webmention" href="/test/17/webmention"><a href="/test/17/webmention/error" rel="webmention">a</a>',
  },
  18: {
    name: 'Multiple Link headers',
    link: [
      `<${base}test/18/webmention/error>; rel="other"`,
      `<${base}test/18/webmention>; rel="webmention"`,
    ],
  },
  19: {
    name: 'One Link header with multiple values',
    link: `<${base}test/19/webmention/error>; rel="other", <${base}test/19/webmention>; rel="webmention"`,
  },
  20: {
    name: '<link> without href is skipped',
    html: '<link rel="webmention"><a href="/test/20/webmention" rel="webmention">ok</a>',
  },
  21: {
    name: 'Endpoint query string is kept',
    html: '<link rel="webmention" href="/test/21/webmention?query=yes">',
    expected: `${base}test/21/webmention?query=yes`,
  },
  22: {
    name: 'Endpoint relative to the page path',
    html: '<link rel="webmention" href="22/webmention">',
  },
}

function page(n: number, test: DiscoveryCase) {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' })
  for (const link of [test.link ?? []].flat()) headers.append(test.linkHeaderName ?? 'Link', link)
  return new Response(
    `<!doctype html><html><head></head><body><p>Test ${n}</p>${test.html ?? ''}</body></html>`,
    {
      headers,
    }
  )
}

describe('webmention.rocks discovery', () => {
  for (const [n, test] of Object.entries(cases)) {
    it(`#${n} ${test.name}`, async () => {
      const url = `${base}test/${n}`
      const fetch = fakeFetch({ [url]: () => page(Number(n), test) })
      assert.equal(
        await discoverEndpoint(url, fetch),
        test.expected ?? `${base}test/${n}/webmention`
      )
    })
  }

  it('#23 resolves a relative endpoint against the redirected URL', async () => {
    const fetch = fakeFetch({
      [`${base}test/23/page`]: () =>
        new Response(null, { status: 302, headers: { location: '/test/23/page/real' } }),
      [`${base}test/23/page/real`]: () =>
        new Response('<html></html>', {
          headers: {
            'content-type': 'text/html',
            link: '<webmention-endpoint/key>; rel=webmention',
          },
        }),
    })
    assert.equal(
      await discoverEndpoint(`${base}test/23/page`, fetch),
      `${base}test/23/page/webmention-endpoint/key`
    )
  })

  it('sends source and target form-encoded, keeping the endpoint query string (#21)', async () => {
    const received: Array<{ url: string; body: string }> = []
    const fetch = fakeFetch({
      [`${base}test/21`]: () => page(21, cases[21]!),
      [`${base}test/21/webmention?query=yes`]: async (req) => {
        received.push({ url: req.url, body: await req.text() })
        return new Response(null, { status: 202 })
      },
    })
    assert.equal(await sendWebmention('https://example.com/post', `${base}test/21`, fetch), true)
    assert.deepEqual(received, [
      {
        url: `${base}test/21/webmention?query=yes`,
        body: new URLSearchParams({
          source: 'https://example.com/post',
          target: `${base}test/21`,
        }).toString(),
      },
    ])
  })
})
