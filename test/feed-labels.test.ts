import assert from 'node:assert/strict'
import test from 'node:test'
import { activity, closeSpokenParagraph, eventExecution, interruptRunningToolEvents, isStopping, isTerminalStatus, reduceThinking, updateToolStepEvent } from '../hooks/use-backend-session'
import { executionLabel, genericToolStepLabel, lifecycleFeedLabels, toolStepLabel } from '../lib/backend/feed-labels'
import type { SessionEvent } from '../lib/backend/client'

const event = (type: string, data: Record<string, unknown>, id = '1700000000000-1'): SessionEvent => ({ id, type, data }) as unknown as SessionEvent

test('machinery lifecycle events never become feed rows', () => {
  for (const type of ['session.queued', 'session.running', 'session.idle', 'session.cancel_requested', 'project.restored', 'agent.finished', 'agent.step']) {
    assert.equal(activity(event(type, {}), 0), null, type)
    assert.equal(lifecycleFeedLabels[type], undefined, type)
  }
})

test('confirmed processing is live copy, independent of sandbox and private step payloads', () => {
  assert.equal(executionLabel(null, 'session.queued'), 'Starting your request…')
  assert.equal(executionLabel(null, 'agent.step'), 'Processing your request…')
  assert.equal(activity(event('agent.step', { secret: 'do not render', number: 2, of: 50 }), 0), null)
  assert.equal(executionLabel('Processing your request…', 'agent.tool_call'), null)
  assert.equal(executionLabel('Processing your request…', 'session.failed'), null)
  assert.equal(activity(event('sandbox.started', {}), 0)?.title, 'Workspace environment started')
  assert.equal(activity(event('desktop.ready', {}), 0)?.title, 'Desktop is ready')
})

test('ending a run cannot invent successful tool results', () => {
  const row = activity(event('agent.tool_call', { name: 'read_file', input: { path: 'x' }, callId: 'c' }), 0)!
  const interrupted = interruptRunningToolEvents([row])
  assert.equal(interrupted[0].status, 'skipped')
  const completed = updateToolStepEvent([row], event('agent.tool_result', { name: 'read_file', callId: 'c' }))
  assert.strictEqual(interruptRunningToolEvents(completed), completed)
})

test('events a person cares about keep plain-language rows', () => {
  assert.equal(activity(event('preview.ready', { url: 'https://x' }), 0)?.title, 'Preview is ready')
  assert.equal(activity(event('project.saved', {}), 0)?.title, 'Saved your work')
  assert.equal(activity(event('session.failed', { error: 'Cancelled by user' }), 0)?.status, 'error')
  assert.equal(activity(event('session.failed', { error: 'Cancelled by user' }), 0)?.title, 'Stopped')
})

test('a confirmed stop is a calm row, and only the server decides when a run is stopping or over', () => {
  const stopped = activity(event('session.stopped', { execution: 3 }), 0)
  assert.equal(stopped?.title, 'Stopped'); assert.equal(stopped?.status, 'complete')
  assert.equal(executionLabel('Processing your request…', 'session.stopped'), null)
  assert.equal(isStopping({ status: 'RUNNING', cancelRequested: true }), true)
  assert.equal(isStopping({ status: 'QUEUED', cancelRequested: true }), true)
  assert.equal(isStopping({ status: 'RUNNING', cancelRequested: false }), false)
  for (const status of ['STOPPED', 'FAILED', 'IDLE'] as const) {
    assert.equal(isStopping({ status, cancelRequested: true }), false, `${status} is over, not stopping`)
    assert.equal(isTerminalStatus(status), true)
  }
  assert.equal(isTerminalStatus('RUNNING'), false)
  assert.equal(eventExecution(event('agent.text', { execution: 2 })), 2)
  assert.equal(eventExecution(event('agent.text', {})), undefined)
  assert.equal(eventExecution(event('agent.text', { execution: '2' })), undefined)
  assert.equal(eventExecution(event('agent.text', { execution: 0 })), undefined)
})

test('tool steps read as what the agent did, with the subject where it helps', () => {
  assert.equal(toolStepLabel('list_files', 'call'), 'Looking through files')
  assert.equal(toolStepLabel('list_files', 'result'), 'Looked through files')
  assert.equal(toolStepLabel('read_file', 'result', { path: 'app/page.tsx' }), 'Read page.tsx')
  assert.equal(toolStepLabel('search_files', 'call', { query: 'useState' }), 'Searching files for “useState”')
  const opened = activity(event('agent.tool_call', { name: 'read_file', input: { path: 'app/page.tsx' }, callId: 'c' }), 0)
  assert.equal(opened?.title, 'Reading page.tsx')
  assert.equal(opened?.status, 'running')
  assert.equal(activity(event('agent.tool_result', { name: 'read_file', isError: false, callId: 'c' }), 0), null, 'a result adds no second row')
  const closed = updateToolStepEvent([opened!], event('agent.tool_result', { name: 'read_file', isError: false, callId: 'c' }))
  assert.equal(closed.length, 1)
  assert.equal(closed[0]?.title, 'Read page.tsx')
  assert.equal(closed[0]?.status, 'complete')
  const failed = updateToolStepEvent([opened!], event('agent.tool_result', { name: 'read_file', isError: true, callId: 'c', text: 'No such file' }))
  assert.equal(failed[0]?.status, 'error')
  assert.equal(failed[0]?.description, undefined)
  assert.equal(failed[0]?.metadata?.diagnostic, 'No such file')
})

test('internal bookkeeping tools are hidden and unknown tools degrade to readable words', () => {
  assert.equal(activity(event('agent.tool_call', { name: 'finish_task', input: { outcome: 'answered' } }), 0), null)
  assert.equal(activity(event('agent.tool_result', { name: 'update_task', isError: false }), 0), null)
  assert.equal(activity(event('agent.tool_call', { name: 'recover_task', input: {} }), 0), null)
  assert.equal(toolStepLabel('render_chart', 'call'), undefined)
  assert.equal(genericToolStepLabel('render_chart', 'call'), 'Using render chart')
  assert.equal(activity(event('agent.tool_call', { name: 'render_chart', input: {} }), 0)?.title, 'Using render chart')
  const row = activity(event('agent.tool_call', { name: 'render_chart', input: {} }), 0)!
  assert.equal(updateToolStepEvent([row], event('agent.tool_result', { name: 'render_chart', isError: false }))[0]?.title, 'Finished render chart')
})

test('web search has one live row that closes with sanitized cited results', () => {
  const opened = activity(event('agent.tool_call', {
    name: 'search_web',
    callId: 'search-1',
    input: { query: 'Tailwind v4 CLI official docs' },
  }), 0)!
  assert.deepEqual([opened.title, opened.status, opened.kind, opened.description],
    ['Researching web', 'running', 'research', 'Tailwind v4 CLI official docs'])
  const [closed] = updateToolStepEvent([opened], event('agent.tool_result', {
    name: 'search_web',
    callId: 'search-1',
    text: JSON.stringify({
      query: 'Tailwind v4 CLI official docs',
      answer: 'ignored in the activity row',
      sources: [
        { title: 'Upgrade guide', url: 'https://tailwindcss.com/docs/upgrade-guide', date: '2026-10-01' },
        { title: 'Unsafe', url: 'javascript:alert(1)' },
      ],
    }),
  }))
  assert.deepEqual([closed.title, closed.status], ['Research complete', 'complete'])
  assert.equal(closed.metadata?.searchQuery, 'Tailwind v4 CLI official docs')
  assert.deepEqual(JSON.parse(String(closed.metadata?.searchResultsJson)), [
    { title: 'Upgrade guide', source: 'https://tailwindcss.com/docs/upgrade-guide', date: '2026-10-01' },
  ])
  const [failed] = updateToolStepEvent([opened], event('agent.tool_result', {
    name: 'search_web',
    callId: 'search-1',
    isError: true,
    text: 'provider error with private detail',
  }))
  assert.deepEqual([failed.title, failed.status, failed.description], ['Research failed', 'error', 'Web search could not finish.'])
  assert.doesNotMatch(failed.description ?? '', /private detail/)
})

test('tool results match both identity and name, including out-of-order results and old events without call IDs', () => {
  const rows = [
    activity(event('agent.tool_call', { name: 'read_file', input: { path: 'a' }, callId: 'a' }, '1-0'), 0)!,
    activity(event('agent.tool_call', { name: 'search_files', input: {}, callId: 'b' }, '2-0'), 1)!,
  ]
  assert.strictEqual(updateToolStepEvent(rows, event('agent.tool_result', { name: 'search_files', callId: 'a' })), rows)
  const updated = updateToolStepEvent(rows, event('agent.tool_result', { name: 'read_file', callId: 'a' }))
  assert.equal(updated[0].status, 'complete'); assert.equal(updated[1].status, 'running')
  assert.strictEqual(updateToolStepEvent(updated, event('agent.tool_result', { name: 'read_file', callId: 'a' })), updated)
  const legacy = updateToolStepEvent(rows, event('agent.tool_result', { name: 'read_file' }))
  assert.equal(legacy[0].status, 'complete'); assert.equal(legacy[1].status, 'running')
})

test('thinking deltas fold into one running row per step that any other run event closes', () => {
  const first = reduceThinking([], event('agent.thinking', { delta: 'Read the ' }, '1700000000001-1'), 1)
  const grown = reduceThinking(first, event('agent.thinking', { delta: 'failing test.' }, '1700000000002-1'), 2)
  assert.equal(grown.length, 1)
  assert.deepEqual([grown[0].kind, grown[0].status, grown[0].title, grown[0].description], ['thinking', 'running', 'Thinking', 'Read the failing test.'])
  const closed = reduceThinking(grown, event('agent.tool_call', { name: 'read_file', input: { path: 'x' } }, '1700000000003-1'), 3)
  assert.equal(closed[0].status, 'complete')
  assert.equal(closed[0].completedAt, new Date(1700000000003).toISOString(), 'the thought ended when the next event was recorded')
  const next = reduceThinking(closed, event('agent.thinking', { delta: 'Now fix it.' }, '1700000000004-1'), 4)
  assert.equal(next.length, 2)
  assert.equal(next[1].description, 'Now fix it.')
  assert.throws(() => reduceThinking([], event('agent.thinking', { delta: 7 }), 0), /invalid thinking event/)
  assert.equal(activity(event('agent.thinking', { delta: 'private' }), 0), null)
})

test('what the agent said before a tool step does not run into what it says after it', () => {
  assert.equal(closeSpokenParagraph(''), '')
  assert.equal(closeSpokenParagraph('Reading the hero first. '), 'Reading the hero first.\n\n')
  assert.equal(closeSpokenParagraph('Already closed.\n\n'), 'Already closed.\n\n')
})

test('question validation failures do not claim a question was asked or expose model-facing schema errors', () => {
  const row = activity(event('agent.tool_call', { name: 'request_user_input', input: {}, callId: 'q1' }), 0)!
  const [failed] = updateToolStepEvent([row], event('agent.tool_result', {
    name: 'request_user_input', callId: 'q1', isError: true,
    text: 'pendingInput.questions[0].options must hold 2–4 choices',
  }))
  assert.equal(failed.status, 'error')
  assert.equal(failed.title, 'The question could not be shown')
  assert.equal(failed.description, undefined)
})

test('a failed tool row reads as customer copy and never shows the model-facing result text', () => {
  const row = activity(event('agent.tool_call', { name: 'start_preview', input: { command: 'npm run dev', port: 3000 }, callId: 'p1' }), 0)!
  const [failed] = updateToolStepEvent([row], event('agent.tool_result', { name: 'start_preview', callId: 'p1', isError: true, text: 'Public previews are disabled. Do not expose another port.' }))
  assert.equal(failed.status, 'error')
  assert.equal(failed.title, 'The preview could not start')
  assert.equal(failed.description, undefined)
  assert.equal(toolStepLabel('git_commit', 'failed'), 'Committing did not finish')
  assert.equal(genericToolStepLabel('render_chart', 'failed'), 'Could not finish render chart')
})
