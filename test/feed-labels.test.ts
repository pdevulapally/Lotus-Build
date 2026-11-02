import assert from 'node:assert/strict'
import test from 'node:test'
import { activity, updateToolStepEvent } from '../hooks/use-backend-session'
import { genericToolStepLabel, lifecycleFeedLabels, toolStepLabel } from '../lib/backend/feed-labels'
import type { SessionEvent } from '../lib/backend/client'

const event = (type: string, data: Record<string, unknown>, id = '1700000000000-1'): SessionEvent => ({ id, type, data }) as unknown as SessionEvent

test('machinery lifecycle events never become feed rows', () => {
  for (const type of ['session.queued', 'session.running', 'session.idle', 'sandbox.started', 'project.restored', 'agent.finished']) {
    assert.equal(activity(event(type, {}), 0), null, type)
    assert.equal(lifecycleFeedLabels[type], undefined, type)
  }
})

test('events a person cares about keep plain-language rows', () => {
  assert.equal(activity(event('preview.ready', { url: 'https://x' }), 0)?.title, 'Preview is ready')
  assert.equal(activity(event('project.saved', {}), 0)?.title, 'Saved your work')
  assert.equal(activity(event('session.failed', { error: 'Cancelled by user' }), 0)?.status, 'error')
  assert.equal(activity(event('session.failed', { error: 'Cancelled by user' }), 0)?.title, 'Stopped')
})

test('tool steps read as what the agent did, with the subject where it helps', () => {
  assert.equal(toolStepLabel('list_files', 'call'), 'Looking through files')
  assert.equal(toolStepLabel('list_files', 'result'), 'Looked through files')
  assert.equal(toolStepLabel('read_file', 'result', { path: 'app/page.tsx' }), 'Read app/page.tsx')
  assert.equal(toolStepLabel('search_files', 'call', { query: 'useState' }), 'Searching files for “useState”')
  const opened = activity(event('agent.tool_call', { name: 'read_file', input: { path: 'app/page.tsx' }, callId: 'c' }), 0)
  assert.equal(opened?.title, 'Reading app/page.tsx')
  assert.equal(opened?.status, 'running')
  assert.equal(activity(event('agent.tool_result', { name: 'read_file', isError: false, callId: 'c' }), 0), null, 'a result adds no second row')
  const closed = updateToolStepEvent([opened!], event('agent.tool_result', { name: 'read_file', isError: false, callId: 'c' }))
  assert.equal(closed.length, 1)
  assert.equal(closed[0]?.title, 'Read app/page.tsx')
  assert.equal(closed[0]?.status, 'complete')
  const failed = updateToolStepEvent([opened!], event('agent.tool_result', { name: 'read_file', isError: true, callId: 'c', text: 'No such file' }))
  assert.equal(failed[0]?.status, 'error')
  assert.equal(failed[0]?.description, 'No such file')
})

test('internal bookkeeping tools are hidden and unknown tools degrade to readable words', () => {
  assert.equal(activity(event('agent.tool_call', { name: 'finish_task', input: { outcome: 'answered' } }), 0), null)
  assert.equal(activity(event('agent.tool_result', { name: 'update_task', isError: false }), 0), null)
  assert.equal(toolStepLabel('render_chart', 'call'), undefined)
  assert.equal(genericToolStepLabel('render_chart', 'call'), 'Using render chart')
  assert.equal(activity(event('agent.tool_call', { name: 'render_chart', input: {} }), 0)?.title, 'Using render chart')
  const row = activity(event('agent.tool_call', { name: 'render_chart', input: {} }), 0)!
  assert.equal(updateToolStepEvent([row], event('agent.tool_result', { name: 'render_chart', isError: false }))[0]?.title, 'Finished render chart')
})
