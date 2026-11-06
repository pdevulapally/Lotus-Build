import assert from 'node:assert/strict'
import test from 'node:test'
import { activity, getFileToolInput } from '../hooks/use-backend-session'
import type { SessionEvent } from '../lib/backend/client'

const call = (name: string, input: Record<string, unknown>, id = '1700000000000-0'): SessionEvent =>
  ({ id, type: 'agent.tool_call', data: { name, input, callId: 'c1' } }) as unknown as SessionEvent

test('edit_file calls become diff-capable feed items', () => {
  const item = activity(call('edit_file', { path: 'app/page.tsx', old_string: 'a', new_string: 'b' }), 0)
  assert.ok(item)
  assert.equal(item.title, 'Editing file')
  assert.equal(item.status, 'running')
  assert.deepEqual(item.metadata, { toolName: 'edit_file', filePath: 'app/page.tsx', editVariant: 'edit', oldContent: 'a', newContent: 'b', callId: 'c1' })
})

test('write_file calls carry the full new content', () => {
  const item = activity(call('write_file', { path: 'lib/x.ts', content: 'export const x = 1\n' }), 0)
  assert.ok(item)
  assert.equal(item.title, 'Creating file')
  assert.equal(item.metadata?.editVariant, 'write')
  assert.equal(item.metadata?.newContent, 'export const x = 1\n')
})

test('malformed file tool input falls back to nothing special', () => {
  assert.equal(getFileToolInput('edit_file', { path: 'x' }), null)
  assert.equal(getFileToolInput('write_file', { content: 'no path' }), null)
})

test('file tool results do not add a second feed item', () => {
  const result = { id: '1700000000001-0', type: 'agent.tool_result', data: { name: 'edit_file', callId: 'c1' } } as unknown as SessionEvent
  assert.equal(activity(result, 1), null)
})
