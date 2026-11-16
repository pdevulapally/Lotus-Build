import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NetlifyDeploymentCard } from '../components/integrations/netlify-deployment-card'
import { loadNetlifyDeploymentHistory, netlifyDeploymentSchema, netlifyPreparationAccess, pendingNetlifyDeployment, type NetlifyDeployment } from '../lib/backend/netlify'
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
    const html = render({ ...pending, status, url: 'https://site.netlify.app', deployUrl: 'https://deploy.netlify.app', adminUrl: 'https://app.netlify.com/projects/site' })
    assert.doesNotMatch(html, /Approve and publish|href="https:/)
  }
})

test('malformed timestamps and mismatched project responses fail validation', async () => {
  for (const field of ['createdAt', 'expiresAt'] as const) assert.equal(netlifyDeploymentSchema.safeParse({ ...pending, [field]: 'not-a-date' }).success, false)
  let calls = 0
  const client = new BackendClient({ origin: 'https://backend.test', token: async () => 'token', fetch: async url => {
    calls++
    return Response.json(String(url).endsWith('/netlify-deployments') ? { deployments: [{ ...pending, projectId: 'other' }] } : { deployment: { ...pending, id: 'other' } })
  } })
  await assert.rejects(client.netlifyDeployments('p1'), /unexpected response/)
  await assert.rejects(client.refreshNetlifyDeployment('p1', 'd1'), /unexpected response/)
  assert.throws(() => client.approveNetlifyDeployment('p1', 'd1', 'invalid'))
  assert.equal(calls, 2, 'Invalid approval never dispatches')
})

test('status reconciliation keeps saved records on partial failure and never approves or repeats uploads', async () => {
  const requests: string[] = []
  const records = [{ ...pending, status: 'processing' as const }, { ...pending, id: 'd2', status: 'uncertain' as const }, { ...pending, id: 'd3' }]
  const client = new BackendClient({ origin: 'https://backend.test', token: async () => 'token', fetch: async url => {
    const path = new URL(String(url)).pathname
    requests.push(path)
    if (path.endsWith('/netlify-deployments')) return Response.json({ deployments: records })
    if (path.endsWith('/d2/refresh')) throw new Error('Interrupted lookup')
    return Response.json({ deployment: { ...records[0], status: 'ready', deployUrl: 'https://deploy.netlify.app/' } })
  } })
  const result = await loadNetlifyDeploymentHistory(client, 'p1', new AbortController().signal)
  assert.equal(result.refreshFailed, true)
  assert.equal(result.deployments[0].status, 'ready')
  assert.equal(result.deployments[1].status, 'uncertain')
  assert.equal(result.deployments[2].status, 'awaiting_approval')
  assert.equal(requests.length, 3)
  assert.ok(requests.every(path => !path.includes('/approve') && !path.includes('/reject') && !path.includes('/prepare')))
})
test('ready deployments render separate immutable and current links independently of sandbox or session state', () => {
  const ready = { ...pending, status: 'ready' as const, deployUrl: 'https://deployment--site.netlify.app/', url: 'https://site.netlify.app/', adminUrl: 'https://app.netlify.com/projects/site/overview' }
  const html = render(ready)
  assert.match(html, /Open Netlify project/); assert.match(html, /Open this deployment/); assert.match(html, /Open current site/); assert.match(html, /noopener noreferrer/)
  assert.doesNotMatch(html, /Approve and publish/)
  assert.equal(netlifyDeploymentSchema.parse(ready).deployUrl, ready.deployUrl)
  assert.throws(() => netlifyDeploymentSchema.parse({ ...ready, adminUrl: 'https://other.example/project' }))
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

test('preparation access requires a real available service, active account, project grant and deploy permission', async () => {
  const signal = new AbortController().signal
  const makeClient = (options: { available?: boolean; connected?: boolean; granted?: boolean; enabled?: boolean }) => {
    const paths: string[] = []
    const connection = { id: 'c1', connector: 'netlify', status: 'active', scopes: [], createdAt: pending.createdAt, updatedAt: pending.createdAt }
    const client = new BackendClient({ origin: 'https://backend.test', token: async () => 'token', fetch: async (url, init) => {
      assert.equal(init?.method, 'GET')
      const path = new URL(String(url)).pathname; paths.push(path)
      if (path === '/connections/catalogue') return Response.json({ connectors: options.available ? [{ key: 'netlify', name: 'Netlify', summary: 'Publish', auth: 'netlify-oauth', status: 'available', capabilities: [] }] : [] })
      if (path === '/connections') return Response.json({ connections: options.connected ? [connection] : [] })
      if (path.endsWith('/tools')) return Response.json({ tools: [{ name: 'deploy', description: 'Prepare', inputSchema: {}, fingerprint: 'a'.repeat(64), readOnly: false, mode: options.enabled ? 'always' : 'off' }] })
      return Response.json({ connection: { ...connection, grantedProjectIds: options.granted ? ['p1'] : [] } })
    } })
    return { client, paths }
  }
  for (const [options, expected] of [
    [{}, 'unavailable'], [{ available: true }, 'connect'],
    [{ available: true, connected: true }, 'access'],
    [{ available: true, connected: true, granted: true }, 'access'],
    [{ available: true, connected: true, granted: true, enabled: true }, 'ready'],
  ] as const) {
    const { client } = makeClient(options)
    assert.equal((await netlifyPreparationAccess(client, 'p1', signal)).state, expected)
  }
})

test('pending deployment lookup reuses unfinished work but not expired approvals or completed builds', () => {
  const now = Date.parse('2026-11-11T12:10:00Z')
  assert.equal(pendingNetlifyDeployment([pending], now)?.id, pending.id)
  assert.equal(pendingNetlifyDeployment([pending], Date.parse('2026-11-11T14:00:00Z')), undefined)
  for (const status of ['preparing', 'uploading', 'processing', 'uncertain'] as const) assert.equal(pendingNetlifyDeployment([{ ...pending, status }], now)?.id, pending.id)
  for (const status of ['ready', 'error', 'rejected'] as const) assert.equal(pendingNetlifyDeployment([{ ...pending, status }], now), undefined)
})
