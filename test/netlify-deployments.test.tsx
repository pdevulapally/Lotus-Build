import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NetlifyDeploymentCard } from '../components/integrations/netlify-deployment-card'
import { netlifyDeploymentSchema, type NetlifyDeployment } from '../lib/backend/netlify'
import { BackendClient } from '../lib/backend/client'

const pending: NetlifyDeployment = { id: 'd1', ownerUid: 'u1', projectId: 'p1', sessionId: 's1', connectionId: 'c1', title: '<My site>', accountSlug: 'chosen-team', publishDirectory: 'custom-output', buildCommand: 'custom-builder --prod',
  sha256: 'a'.repeat(64), bytes: 2500, files: 3, createdAt: '2026-11-11T12:00:00Z', expiresAt: '2026-11-11T13:00:00Z', status: 'awaiting_approval' }
const render = (record: NetlifyDeployment, busy = false, now = Date.parse('2026-11-11T12:10:00Z')) => renderToStaticMarkup(createElement(NetlifyDeploymentCard, { record, busy, now, onSubmit: () => {} }))
test('deployment review renders the exact destination, build, disclosure and approval without advertising a live URL', () => {
  const html = render(pending)
  for (const content of ['chosen-team', 'custom-output', 'custom-builder --prod', 'Approve and publish', 'Create a new site', 'Netlify plan and usage limits apply', '&lt;My site&gt;']) assert.ok(html.includes(content), content)
  assert.equal(html.includes('Open this deployment'), false)
  assert.match(render(pending, true), /disabled=""/)
})
test('expired, uncertain and processing builds cannot be approved or presented as published', () => {
  const expired = render(pending, false, Date.parse('2026-11-11T14:00:00Z'))
  assert.match(expired, /Build review expired/); assert.doesNotMatch(expired, /Approve and publish/)
  for (const status of ['processing', 'uncertain', 'error', 'rejected', 'uploading'] as const) {
    const html = render({ ...pending, status })
    assert.doesNotMatch(html, /Approve and publish|Open this deployment/)
  }
})
test('ready deployments render separate immutable and current links independently of sandbox or session state', () => {
  const ready = { ...pending, status: 'ready' as const, deployUrl: 'https://deployment--site.netlify.app/', url: 'https://site.netlify.app/' }
  const html = render(ready)
  assert.match(html, /Open this deployment/); assert.match(html, /Open current site/); assert.match(html, /noopener noreferrer/)
  assert.doesNotMatch(html, /Approve and publish/)
  assert.equal(netlifyDeploymentSchema.parse(ready).deployUrl, ready.deployUrl)
  for (const url of ['javascript:alert(1)', 'http://site.netlify.app', 'https://user:secret@site.netlify.app']) assert.throws(() => netlifyDeploymentSchema.parse({ ...ready, deployUrl: url }))
})
test('OAuth completion and deployment approval use authenticated backend contracts and the reviewed artifact hash', async () => {
  const calls: { path: string; body: unknown; method: string }[] = []
  const client = new BackendClient({ origin: 'https://backend.test', token: async () => 'firebase-token', fetch: async (url, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer firebase-token')
    calls.push({ path: String(url), body: init?.body ? JSON.parse(String(init.body)) : null, method: init?.method ?? 'GET' })
    if (String(url).endsWith('/complete')) return Response.json({ connection: { id: 'c1', connector: 'netlify', status: 'active', scopes: [], createdAt: pending.createdAt, updatedAt: pending.createdAt } })
    return Response.json({ deployment: pending })
  } })
  await client.completeNetlifyConnection({ code: 'code', state: 'one-use-state', returnTo: 'https://app.test/integrations/netlify/setup' })
  await client.approveNetlifyDeployment('p1', 'd1', pending.sha256)
  assert.deepEqual(calls[1], { path: 'https://backend.test/projects/p1/netlify-deployments/d1/approve', method: 'POST', body: { sha256: pending.sha256 } })
  assert.equal(calls[0]?.path, 'https://backend.test/connections/netlify/complete')
})
