import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SupportAccessPanel } from '../components/settings/support-access-panel'
import { supportAccessSchema } from '../lib/backend/client'
import type { SupportAccessController } from '../hooks/use-support-access'

const idle: SupportAccessController = { data: null, code: null, loading: false, busy: false, error: null, refresh: async () => {}, generate: async () => {}, cancelCode: async () => {}, endAccess: async () => {} }
const render = (state: Partial<SupportAccessController>) => renderToStaticMarkup(createElement(SupportAccessPanel, { support: { ...idle, ...state } }))
const empty = supportAccessSchema.parse({ code: null, grant: null, events: [] })

test('before anything is shared the panel offers a code and explains what it allows', () => {
  const html = render({ data: empty })
  assert.match(html, /Generate support code/)
  assert.match(html, /read-only, for 24 hours/)
  assert.doesNotMatch(html, /End access now/)
})

test('a freshly generated code is shown once with its expiry; a code the server only knows about is not shown', () => {
  const shown = render({ data: { ...empty, code: { expiresAt: '2026-11-14T13:15:00Z' } }, code: { code: 'K7PM-3XQ2', expiresAt: '2026-11-14T13:15:00Z' } })
  assert.match(shown, /K7PM-3XQ2/)
  assert.match(shown, /Cancel code/)
  const hidden = render({ data: { ...empty, code: { expiresAt: '2026-11-14T13:15:00Z' } } })
  assert.doesNotMatch(hidden, /K7PM-3XQ2/)
  assert.match(hidden, /A code is waiting/)
})

test('while support has access the customer sees until when, can end it, and sees each chat support opened', () => {
  const html = render({ data: supportAccessSchema.parse({ code: null, grant: { id: 'g', grantedAt: '2026-11-14T13:00:00Z', expiresAt: '2026-11-15T13:00:00Z' },
    events: [{ id: '2', kind: 'chat-viewed', at: '2026-11-14T13:05:00Z', by: 'support', sessionId: 's1' }, { id: '1', kind: 'granted', at: '2026-11-14T13:00:00Z', by: 'support' }] }) })
  assert.match(html, /End access now/)
  assert.match(html, /Support opened one of your build chats/)
  assert.match(html, /Support access started/)
  assert.doesNotMatch(html, /Generate support code/)
})

test('the contract never carries the code itself back from the server', () => {
  assert.throws(() => supportAccessSchema.parse({ code: { code: 'K7PM-3XQ2', expiresAt: 'x' }, grant: null, events: [] }))
})
