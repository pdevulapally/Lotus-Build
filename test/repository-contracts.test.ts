import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { collectProjectDeliveries } from '../lib/projects/repository-deliveries'
import type { Delivery } from '../lib/backend/delivery'

test('branch browsing sends the same encoded saved ref to file listing and content requests', async () => {
  const requests: URL[] = []
  const controller = new AbortController()
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'id-token', fetch: async (input, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer id-token')
    assert.equal(init?.signal, controller.signal)
    const url = new URL(String(input)); requests.push(url)
    return Response.json(url.pathname.endsWith('/content')
      ? { path: 'src/a #.tsx', size: 3, binary: false, content: 'abc', truncated: false }
      : { head: 'main', ref: 'lotusbuild/task-1', branches: ['main', 'lotusbuild/task-1'], files: [{ path: 'src/a #.tsx', size: 3 }], truncated: false })
  } })
  await client.files('p1', controller.signal, 'lotusbuild/task-1')
  await client.file('p1', 'src/a #.tsx', controller.signal, 'lotusbuild/task-1')
  assert.equal(requests[0].pathname, '/projects/p1/files')
  assert.equal(requests[1].pathname, '/projects/p1/files/content')
  assert.equal(requests[1].searchParams.get('path'), 'src/a #.tsx')
  assert.ok(requests.every((url) => url.searchParams.get('ref') === 'lotusbuild/task-1'))
  const count = requests.length
  assert.throws(() => client.files('p1', undefined, 'main&other=1'))
  assert.throws(() => client.file('p1', 'src/App.tsx', undefined, 'bad\nref'))
  assert.equal(requests.length, count)
})

const delivery: Delivery = {
  id: 'd1', provider: 'github', repository: 'owner/repo', title: 'A saved pull request', branch: 'feature', baseBranch: 'main',
  pullRequestNumber: 12, pullRequestUrl: 'https://github.com/owner/repo/pull/12', headSha: 'a'.repeat(40),
  status: 'CHECKS_PENDING', checksPassed: 0, checksTotal: 2, failedChecks: [], updatedAt: '2026-11-11T12:00:00Z',
}

test('repository PRs deduplicate by repository and number and keep the newest live status', () => {
  const latest: Delivery = { ...delivery, status: 'READY_TO_MERGE', checksPassed: 2, updatedAt: '2026-11-11T13:00:00Z' }
  const other: Delivery = { ...delivery, repository: 'owner/other', id: 'd2' }
  assert.deepEqual(collectProjectDeliveries([{ delivery }, {}, { delivery: other }], latest), [latest, other])
  assert.deepEqual(collectProjectDeliveries([{ delivery: latest }], delivery), [latest])
  assert.deepEqual(collectProjectDeliveries([]), [])
})
