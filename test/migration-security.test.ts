import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePreviewMessage, previewUrl } from '../lib/preview'
import nextConfig from '../next.config.mjs'

test('generated previews cannot execute on the application origin or an insecure remote origin', () => {
  const app = 'https://lotus.example'
  assert.equal(previewUrl('https://sandbox.example/page', app), 'https://sandbox.example/page')
  assert.equal(previewUrl('http://localhost:4000', 'http://localhost:3000'), 'http://localhost:4000/')
  for (const value of [null, '/page', 'https://lotus.example/page', 'https://u:p@sandbox.example', 'http://sandbox.example', 'http://localhost:4000', 'javascript:alert(1)', 'data:text/html,hello']) {
    assert.throws(() => previewUrl(value, app))
  }
})

test('preview messages validate bounded geometry, payloads, navigation and section kinds', () => {
  const selection = { type: 'preview-select', id: 'element', rect: { x: 0, y: -10, width: 20, height: 30 }, viewport: { w: 390, h: 800 }, snapshot: { content: 'Hello', styles: { color: 'red' } } }
  assert.deepEqual(parsePreviewMessage(selection), selection)
  assert.ok(parsePreviewMessage({ type: 'preview-navigate', path: '/page?q=hello%20world#section' }))
  for (const value of [
    { ...selection, viewport: { w: 0, h: 100 } }, { ...selection, rect: { ...selection.rect, x: Infinity } },
    { ...selection, snapshot: { styles: { color: { unsafe: true } } } }, { ...selection, snapshot: { content: 'x'.repeat(20_001) } },
    { type: 'preview-structure', sections: [{ id: 's1', label: 'Section', kind: 'invented' }] },
    ...['//evil.test', '/\\evil.test', 'https://evil.test', '/page\n'].map((path) => ({ type: 'preview-navigate', path })),
  ]) assert.equal(parsePreviewMessage(value), null)
})

test('all routes deny embedding and objects, with transport enforcement confined to production', async () => {
  const previous = process.env.NODE_ENV
  try {
    for (const environment of ['development', 'production']) {
      Object.assign(process.env, { NODE_ENV: environment })
      assert.ok(nextConfig.headers)
      const rules = await nextConfig.headers()
      const headers = new Headers(rules[0]!.headers.map(({ key, value }): [string, string] => [key, value]))
      assert.equal(rules[0]!.source, '/:path*')
      assert.equal(headers.get('content-security-policy'), "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
      assert.equal(headers.get('x-frame-options'), 'DENY')
      assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups')
      assert.equal(headers.has('strict-transport-security'), environment === 'production')
    }
  } finally { if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV'); else Object.assign(process.env, { NODE_ENV: previous }) }
})
