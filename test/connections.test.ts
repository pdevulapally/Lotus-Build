import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { BackendClient } from '../lib/backend/client'
import { catalogueSchema, connectionSchema, connectorKeys, connectionStatuses, statusLabel } from '../lib/backend/connections'

const connection = { id: 'c1', connector: 'netlify', status: 'active', createdAt: '2026-10-31T20:00:00.000Z', updatedAt: '2026-10-31T20:00:00.000Z',
  account: { id: 'acct', name: 'Alice' }, scopes: ['sites:read'], grantedProjectIds: ['p1'] }

test('a connection response is rejected outright if the server ever leaks a credential field', () => {
  assert.deepEqual(connectionSchema.parse(connection), connection)
  for (const leak of [{ accessToken: 'secret' }, { credential: { ciphertext: 'x' } }, { vercelToken: 'tok' }]) {
    assert.throws(() => connectionSchema.parse({ ...connection, ...leak }), Object.keys(leak)[0])
  }
})

test('provider credentials are not part of the client-readable project document', () => {
  const types = readFileSync(new URL('../lib/projects/types.ts', import.meta.url), 'utf8')
  assert.equal(/vercelToken|netlifyToken|accessToken|apiKey/i.test(types), false)
})

test('catalogue keeps the agreed provider order and every lifecycle state has a label', () => {
  assert.deepEqual([...connectorKeys], ['netlify', 'vercel', 'slack', 'aws', 'mcp'])
  for (const status of connectionStatuses) assert.ok(statusLabel[status].length > 0, status)
  assert.throws(() => catalogueSchema.parse({ connectors: [{ key: 'github', name: 'GitHub', description: '', authKind: 'oauth2', status: 'active', capabilities: [] }] }))
})

test('connection requests go to the configured backend origin at root-level paths with the bearer token', async () => {
  const calls: string[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer token')
    return Response.json(String(input).endsWith('/connections/catalogue') ? { connectors: [] } : { connections: [] })
  } })
  await client.connectionCatalogue(); await client.connections()
  assert.deepEqual(calls, ['GET https://api.example.test/connections/catalogue', 'GET https://api.example.test/connections'])
})
