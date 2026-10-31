import assert from 'node:assert/strict'
import test from 'node:test'
import { durablePendingStorage } from '../lib/backend/pending-storage'

function storage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

test('moving a pending command out of tab storage preserves its original identity across tab closure', () => {
  const durable = storage(); const tab = storage()
  tab.setItem('command', 'original-identity')
  assert.equal(durablePendingStorage(durable, tab).getItem('command'), 'original-identity')
  assert.equal(tab.getItem('command'), null)
  assert.equal(durablePendingStorage(durable, storage()).getItem('command'), 'original-identity')
})

test('conflicting pending identities fail explicitly and remain available for review', () => {
  const durable = storage(); const tab = storage()
  durable.setItem('command', 'one'); tab.setItem('command', 'two')
  assert.throws(() => durablePendingStorage(durable, tab).getItem('command'), /need review/)
  assert.equal(durable.getItem('command'), 'one'); assert.equal(tab.getItem('command'), 'two')
})
