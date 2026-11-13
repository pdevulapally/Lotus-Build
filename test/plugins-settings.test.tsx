import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PluginPermissions } from '../components/settings/plugins-panel'
import { BackendClient } from '../lib/backend/client'
import { pluginToolsSchema, type PluginTool } from '../lib/backend/connections'

const tools: PluginTool[] = [
  { name: 'read_record', description: '<unsafe> is text', inputSchema: { type: 'object' }, fingerprint: 'a'.repeat(64), readOnly: true, mode: 'off' },
  { name: 'change_record', description: 'Update a record', inputSchema: { type: 'object' }, fingerprint: 'b'.repeat(64), readOnly: false, mode: 'off' },
]

test('tool settings render explicit reviewed access choices and escape third-party descriptions', () => {
  const html = renderToStaticMarkup(createElement(PluginPermissions, { tools, disabled: false, onChange: () => {} }))
  assert.match(html, /Access for read_record/)
  assert.match(html, /Access for change_record/)
  assert.match(html, /role="radio"[^>]*aria-disabled="true"[^>]*data-value="read-only"/)
  assert.equal((html.match(/role="radio" aria-checked="true" data-value="off"/g) ?? []).length, 2)
  assert.match(html, /&lt;unsafe&gt;/)
  assert.doesNotMatch(html, /<unsafe>/)
  assert.match(html, /provider for strict read-only access/)
})

test('permission requests contain exact reviewed fingerprints and global revocation needs no stale tool list', async () => {
  const sent: { path: string; body: unknown }[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'account-token', fetch: async (url, init) => {
    sent.push({ path: String(url), body: JSON.parse(String(init?.body)) })
    return Response.json({ tools })
  } })
  await client.setPluginPermissions('connection-1', [{ ...tools[0]!, mode: 'read-only' }, tools[1]!])
  assert.deepEqual(sent[0], { path: 'https://api.example.test/connections/connection-1/tools', body: { permissions: [
    { name: 'read_record', fingerprint: 'a'.repeat(64), mode: 'read-only' }, { name: 'change_record', fingerprint: 'b'.repeat(64), mode: 'off' },
  ] } })
  await client.setPluginPermissions('connection-1', tools)
  assert.deepEqual(sent[1]!.body, { permissions: [] })
})

test('plugin responses reject unknown permissions and credential-shaped extra fields', () => {
  assert.deepEqual(pluginToolsSchema.parse({ tools }).tools, tools)
  assert.throws(() => pluginToolsSchema.parse({ tools: [{ ...tools[0], mode: 'automatic' }] }))
  assert.throws(() => pluginToolsSchema.parse({ tools: [{ ...tools[0], accessToken: 'secret' }] }))
})
