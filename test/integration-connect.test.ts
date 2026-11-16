import assert from 'node:assert/strict'
import test from 'node:test'
import type { Connector } from '../lib/backend/connections'
import { allowConnectionForProject, completeIntegration, connectIntegration, deliverOutcome, integrationCallbackUrl, takeRedirectOutcome, type ConnectOutcome } from '../lib/integrations/connect'

const netlify: Connector = { key: 'netlify', name: 'Netlify', summary: '', auth: 'netlify-oauth', browserCallback: true, capabilities: [], status: 'available' }
const github: Connector = { ...netlify, key: 'github', name: 'GitHub', auth: 'github-app' }
const connected: ConnectOutcome = { status: 'connected', connector: 'netlify', connectionId: 'c1', account: 'My team' }

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}

test('each sign-in method completes with exactly what its provider returned; anything else completes nothing', async () => {
  const calls: unknown[] = []
  const client: any = {
    completeNetlifyConnection: async (input: unknown) => { calls.push(input); return { connection: { id: 'c1', account: { name: 'My team' } } } },
    completeGitHubConnection: async (input: unknown) => { calls.push(input); return { connection: { id: 'c2' } } },
  }
  const returnTo = integrationCallbackUrl('https://app.test', 'netlify')
  assert.equal(returnTo, 'https://app.test/integrations/netlify/setup')
  assert.deepEqual(await completeIntegration(client, netlify, new URLSearchParams('code=a&state=b'), returnTo), connected)
  assert.deepEqual(await completeIntegration(client, github, new URLSearchParams('code=a&state=b&installation_id=7'), 'r'), { status: 'connected', connector: 'github', connectionId: 'c2' })
  assert.deepEqual(calls, [{ state: 'b', code: 'a', returnTo }, { state: 'b', code: 'a', installationId: 7, returnTo: 'r' }])
  for (const [connector, query] of [[netlify, 'error=access_denied&code=a&state=b'], [netlify, 'code=a'], [github, 'setup_action=update'], [{ ...netlify, auth: 'unknown' }, 'code=a&state=b']] as const) {
    assert.equal((await completeIntegration(client, connector, new URLSearchParams(query), 'r')).status, 'cancelled')
  }
  assert.equal(calls.length, 2)
})

test('a failed exchange reports a plain message, never provider or server text', async () => {
  const client: any = { completeNetlifyConnection: async () => { throw new Error('Raw secret diagnostic') } }
  const outcome = await completeIntegration(client, netlify, new URLSearchParams('code=a&state=b'), 'r')
  assert.deepEqual(outcome, { status: 'failed', connector: 'netlify', message: 'Netlify could not be connected. Try again.' })
})

test('the popup reports on the channel and closes; a redirect returns to the starting page with the outcome waiting', async () => {
  const listener = new BroadcastChannel('lotusbuild:integration-connect')
  const received = new Promise(resolve => { listener.onmessage = event => resolve(event.data) })
  assert.deepEqual(deliverOutcome(connected, storage()), { close: true })
  assert.deepEqual(await received, connected)
  listener.close()

  const tab = storage({ 'lotusbuild:integration-return': '/computer/abc?tab=preview' })
  assert.deepEqual(deliverOutcome(connected, tab), { close: false, path: '/computer/abc?tab=preview' })
  assert.deepEqual(takeRedirectOutcome(tab), connected)
  assert.equal(takeRedirectOutcome(tab), null, 'the outcome is read once')
  for (const unsafe of ['https://evil.test/', '//evil.test', '/\\evil.test', 'javascript:alert(1)']) {
    assert.deepEqual(deliverOutcome(connected, storage({ 'lotusbuild:integration-return': unsafe })), { close: false, path: '/integrations' })
  }
  assert.equal(takeRedirectOutcome(storage({ 'lotusbuild:integration-outcome': '{"status":"owned"}' })), null)
})

test('connecting opens the provider in a popup with the registered callback and the requested project, and resolves from the channel', async () => {
  const inputs: unknown[] = []; const opened: string[] = []
  const client: any = { startConnection: async (key: string, input: unknown) => { inputs.push([key, input]); return { authorizeUrl: 'https://provider.test/authorize' } } }
  const session = storage({ 'lotusbuild:integration-return': '/stale' })
  const popup = { closed: false, close() { this.closed = true }, location: { replace: (url: string) => {
    opened.push(url)
    const channel = new BroadcastChannel('lotusbuild:integration-connect'); channel.postMessage(connected); channel.close()
  } } }
  ;(globalThis as any).window = { open: () => popup, sessionStorage: session, location: { origin: 'https://app.test', pathname: '/computer/abc', search: '', assign: () => assert.fail('no redirect when a popup opened') } }
  try {
    assert.deepEqual(await connectIntegration(client, netlify, { projectIds: ['p1'] }), connected)
    assert.deepEqual(inputs, [['netlify', { returnTo: 'https://app.test/integrations/netlify/setup', projectIds: ['p1'] }]])
    assert.deepEqual(opened, ['https://provider.test/authorize'])
    assert.equal(session.values.has('lotusbuild:integration-return'), false)

    // A blocked popup falls back to a redirect that remembers where to return.
    const assigned: string[] = []
    ;(globalThis as any).window = { open: () => null, sessionStorage: session, location: { origin: 'https://app.test', pathname: '/computer/abc', search: '?tab=preview', assign: (url: string) => assigned.push(url) } }
    assert.deepEqual(await connectIntegration(client, netlify), { status: 'redirecting' })
    assert.deepEqual(assigned, ['https://provider.test/authorize'])
    assert.equal(session.values.get('lotusbuild:integration-return'), '/computer/abc?tab=preview')
  } finally { delete (globalThis as any).window }
})

test('allowing a project adds only that grant and that permission, and changes nothing already in place', async () => {
  const writes: unknown[] = []
  const tools = [{ name: 'deploy', fingerprint: 'f1', mode: 'off' }, { name: 'sites.read', fingerprint: 'f2', mode: 'read-only' }]
  const client = (granted: string[] | undefined, current = tools): any => ({
    connection: async () => ({ connection: { grantedProjectIds: granted } }),
    setConnectionGrants: async (id: string, projectIds: string[]) => { writes.push(['grants', id, projectIds]) },
    pluginTools: async () => ({ tools: current }),
    setPluginPermissions: async (id: string, next: { name: string; mode: string }[]) => { writes.push(['tools', id, next.map(tool => [tool.name, tool.mode])]) },
  })
  await allowConnectionForProject(client(['p0']), 'c1', 'p1', ['deploy'])
  assert.deepEqual(writes, [['grants', 'c1', ['p0', 'p1']], ['tools', 'c1', [['deploy', 'always'], ['sites.read', 'read-only']]]])
  writes.length = 0
  await allowConnectionForProject(client(['p1'], [{ ...tools[0]!, mode: 'always' }, tools[1]!]), 'c1', 'p1', ['deploy'])
  assert.deepEqual(writes, [], 'nothing is rewritten when access is already in place')
  await assert.rejects(allowConnectionForProject(client(undefined), 'c1', 'p1', ['deploy']), /could not be verified/)
  await assert.rejects(allowConnectionForProject(client(['p1'], [tools[1]!]), 'c1', 'p1', ['deploy']), /required permission/)
  assert.deepEqual(writes, [])
})
