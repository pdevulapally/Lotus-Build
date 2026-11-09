import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionEvent } from '../lib/backend/client'
import type { ComputerTimelineEvent } from '../components/computer/session-types'
import { sessionEventStatus } from '../lib/backend/session-snapshot'
import { executionLabel } from '../lib/backend/feed-labels'
import { activity, closeSpokenParagraph, interruptRunningToolEvents, isTerminalStatus, reduceThinking, updateCommandEvent, updateToolStepEvent } from '../hooks/use-backend-session'
import { renderAgentFeed, type AgentFeedProps } from './support/render-agent-feed'

/**
 * The event logs the server-side feed fixtures (lotusbuild-server test/agent-feed-fixtures.test.ts) showed the
 * runner emitting — shaped exactly as `src/runner/loop.ts` publishes them — pushed through the frontend's real
 * reducer path (`useBackendSession`'s per-event steps, in its order) and the real `AgentFeed` render. What is
 * asserted is what a person would see for each sequence. Deterministic: no server, no model.
 */
type BackendStatus = 'QUEUED' | 'RUNNING' | 'IDLE' | 'STOPPED' | 'FAILED'
interface FeedState { status: BackendStatus; liveLabel: string | null; streamText: string; events: ComputerTimelineEvent[] }
const initial = (): FeedState => ({ status: 'RUNNING', liveLabel: null, streamText: '', events: [] })

/** One server event: ids are `<ms>-<sequence>` as the journal issues them. */
let sequence = 0
const at = 1_762_430_400_000
const ev = (type: string, data: Record<string, unknown> = {}): SessionEvent => { sequence += 1; return { id: `${at + sequence * 1000}-${sequence}`, type, data } }
const resetClock = () => { sequence = 0 }

/** Mirrors the hook's `onEvent` (hooks/use-backend-session.ts) step for step, minus React state plumbing. */
function apply(state: FeedState, event: SessionEvent): FeedState {
  let { status, liveLabel, streamText, events } = state
  const confirmed = sessionEventStatus[event.type]
  if (confirmed) status = confirmed
  liveLabel = executionLabel(liveLabel, event.type)
  if (event.type === 'session.running') streamText = ''
  if (event.type === 'agent.tool_call' && streamText.length > 0) streamText = closeSpokenParagraph(streamText)
  if (event.type === 'agent.text') streamText += String(event.data.delta)
  if (event.type === 'agent.tool_result') events = updateToolStepEvent(updateCommandEvent(events, event), event)
  const index = Number(event.id!.split('-')[0])
  events = reduceThinking(events, event, index)
  const item = activity(event, index)
  if (item) events = [...events, item].slice(-300)
  if (confirmed !== undefined && isTerminalStatus(confirmed)) events = interruptRunningToolEvents(events)
  return { status, liveLabel, streamText, events }
}
const play = (log: SessionEvent[]): FeedState => log.reduce(apply, initial())

/** app/computer/[id]/page.tsx: how the session's status reaches the feed. */
const feedStatus = (status: BackendStatus): AgentFeedProps['status'] =>
  status === 'FAILED' ? 'error' : status === 'STOPPED' ? 'stopped' : status === 'QUEUED' ? 'queued' : status === 'IDLE' ? 'idle' : 'running'
const render = (state: FeedState) => renderAgentFeed({ status: feedStatus(state.status), liveLabel: state.liveLabel, streamText: state.streamText, events: state.events })
const rows = (state: FeedState) => state.events.map((e) => `${e.title}:${e.status}`)
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('small edit: write, then the agent reads the file back, then it answers — each tool shows its attempt and its result, in order, and nothing claims more than happened', () => {
  resetClock()
  const state = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'write_file', input: { path: 'src/App.tsx', content: '<h1>New</h1>' }, callId: 'c1' }),
    ev('agent.tool_result', { callId: 'c1', name: 'write_file', isError: false, text: 'Wrote src/App.tsx' }),
    ev('agent.step', { step: 2 }),
    ev('agent.tool_call', { name: 'read_file', input: { path: 'src/App.tsx' }, callId: 'c2' }),
    ev('agent.tool_result', { callId: 'c2', name: 'read_file', isError: false, text: '<h1>New</h1>' }),
    ev('agent.step', { step: 3 }), ev('agent.text', { delta: 'Renamed the heading.' }),
    ev('session.idle', { steps: 3, stopReason: 'end_turn' }),
  ])
  assert.deepEqual(rows(state), ['Creating file:complete', 'Read src/App.tsx:complete'], 'one row per real tool attempt, closed by its own result; bookkeeping steps add no rows')
  const html = render(state)
  assert.match(html, /Created/); assert.match(html, /Read src\/App\.tsx/); assert.match(html, /Renamed the heading\./)
  assert.doesNotMatch(html, /Couldn|Interrupted|Working|Processing your request/)
  assert.equal(state.liveLabel, null, 'the live line is cleared when the turn ends')
})

test('ambiguity: the model asks instead of acting — the question is what the feed shows and no work row appears', () => {
  resetClock()
  const state = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'request_user_input', input: { question: 'Make what better?' }, callId: 'q1' }),
    ev('agent.tool_result', { callId: 'q1', name: 'request_user_input', isError: false, text: 'asked' }),
    ev('session.awaiting_input', {}),
  ])
  assert.deepEqual(rows(state), ['Asked you a question:complete', 'Waiting for you:complete'])
  assert.doesNotMatch(render(state), /Running command|Creating file|Editing file/)
})

test('seeded failure, then the repair: the failed command stays failed with its output, the fix and the passing re-run follow in order — the feed never rewrites the attempt that failed', () => {
  resetClock()
  const state = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm test' }, callId: 'r1' }),
    ev('agent.tool_result', { callId: 'r1', name: 'run_command', isError: true, text: 'exit 1\nAssertionError: expected 2 to equal 3' }),
    ev('agent.step', { step: 2 }),
    ev('agent.tool_call', { name: 'write_file', input: { path: 'src/sum.ts', content: 'export const sum = (a: number, b: number) => a + b' }, callId: 'w1' }),
    ev('agent.tool_result', { callId: 'w1', name: 'write_file', isError: false, text: 'ok' }),
    ev('agent.step', { step: 3 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm test' }, callId: 'r2' }),
    ev('agent.tool_result', { callId: 'r2', name: 'run_command', isError: false, text: 'exit 0\n1 passing' }),
    ev('session.idle', { steps: 3, stopReason: 'end_turn' }),
  ])
  assert.deepEqual(rows(state), ['Running command:error', 'Creating file:complete', 'Running command:complete'])
  assert.equal(state.events[0]!.metadata?.commandOutput && String(state.events[0]!.metadata.commandOutput).includes('AssertionError'), true, 'the failed attempt keeps its real output')
  const html = strip(render(state))
  assert.match(html, /Command failed[\s\S]*Created[\s\S]*Ran command/, 'failure, fix, success — in that order')
})

test('cancellation: Stop lands while a command runs — the row reads interrupted, the turn reads Stopped, and nothing after the Stop appears because the runner emitted nothing after it', () => {
  resetClock()
  const state = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm run build' }, callId: 'r1' }),
    ev('session.stopped', {}),
  ])
  assert.deepEqual(rows(state), ['Running command:skipped', 'Stopped:complete'])
  const html = render(state)
  assert.match(html, /Command interrupted/); assert.match(html, /Stopped/)
  assert.doesNotMatch(html, /Ran command|Command failed|text-destructive/)
})

test('resume: a new run after a Stop keeps the interrupted history, starts its live line afresh, and the resumed work appends with its own results', () => {
  resetClock()
  const before = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm run build' }, callId: 'r1' }),
    ev('session.stopped', {}),
  ])
  const resumed = [
    ev('session.running', { execution: 2 }), ev('agent.step', { step: 2 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm run build' }, callId: 'r2' }),
    ev('agent.tool_result', { callId: 'r2', name: 'run_command', isError: false, text: 'built' }),
    ev('agent.text', { delta: 'Build passes.' }), ev('session.idle', { steps: 2, stopReason: 'end_turn' }),
  ]
  const afterRunning = apply(before, resumed[0]!)
  assert.equal(afterRunning.liveLabel, 'Starting your request…'); assert.equal(afterRunning.streamText, '')
  const state = resumed.slice(1).reduce(apply, afterRunning)
  assert.deepEqual(rows(state), ['Running command:skipped', 'Stopped:complete', 'Running command:complete'], 'the interrupted attempt is history, not re-run; the resumed attempt has its own result')
  const html = strip(render(state))
  assert.match(html, /Command interrupted[\s\S]*Stopped[\s\S]*Ran command[\s\S]*Build passes\./)
})

test('lost event: the runner failed to write the command\'s failing result (reproduced server-side, not fixed) — the person sees the command as interrupted, then a confident answer, and no sign that anything was lost', () => {
  resetClock()
  const state = play([
    ev('session.running'), ev('agent.step', { step: 1 }),
    ev('agent.tool_call', { name: 'run_command', input: { command: 'npm test' }, callId: 'r1' }),
    // sequence 4 (agent.tool_result isError:true) was never journaled: the next event carries the next sequence.
    ev('agent.step', { step: 2 }),
    ev('agent.text', { delta: 'The tests fail on sum(); fixing the assertion next.' }),
    ev('session.idle', { steps: 2, stopReason: 'end_turn' }),
  ])
  assert.deepEqual(rows(state), ['Running command:skipped'], 'with no result ever received the row cannot be closed; the end of the turn marks it interrupted')
  const html = render(state)
  assert.match(html, /Command interrupted/); assert.match(html, /Interrupted before a result was received/)
  assert.match(html, /The tests fail on sum\(\)/, 'the agent\'s words, which rest on a result the feed never got, are shown as normal')
  assert.doesNotMatch(html, /Command failed|not recorded|lost|missing/i, 'nothing tells the person an event was lost: the ids are contiguous, so neither reducer nor render can know')
})

test('no_progress: the server appends its limitation sentence to the reply and the feed shows it verbatim — the copy is the server\'s (agent.ts, loop.ts), not the frontend\'s', () => {
  const reply = 'I updated the heading.\n\nThe goal is not verified as complete. Work stopped because repeated attempts made no safe progress or the evidence limit was reached.'
  const html = strip(renderAgentFeed({ status: 'idle', canonicalMessages: [{ seq: 1, role: 'assistant', content: reply, createdAt: new Date(at).toISOString() }] }))
  assert.match(html, /The goal is not verified as complete\. Work stopped because repeated attempts made no safe progress or the evidence limit was reached\./)
})
