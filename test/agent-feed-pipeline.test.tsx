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
  assert.deepEqual(rows(state), ['Creating file:complete', 'Read App.tsx:complete'], 'one row per real tool attempt, closed by its own result; bookkeeping steps add no rows')
  const html = render(state)
  assert.match(html, /Created/); assert.match(html, /Read/); assert.match(html, /App\.tsx/); assert.match(html, /Renamed the heading\./)
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

// ── Incomplete feed: the server's durable facts and the stream's own declaration, rendered ──
import { incompleteDescription, incompleteRunFromEvent, incompleteRunsShown, mergeSessionEvidence, runEndFromEvent, runEndUnrecorded, type RunEnd, type RunEnds, type RunStart } from '../lib/backend/feed-incomplete'
const notices = (html: string, id: string) => html.split(`data-testid="${id}"`).length - 1
const record = (execution: number) => ({ execution, lost: 1, lastType: 'agent.tool_result', since: '2026-11-06T18:00:00.000Z' })

test('lost event with the server\'s record: the same timeline as the lost-event case now carries one warning for that run — the feed is not presented as complete', () => {
  resetClock()
  const state = play([ev('session.running', { execution: 1 }), ev('agent.step', { execution: 1, step: 1 }),
    ev('agent.tool_call', { execution: 1, name: 'run_command', input: { command: 'npm test' }, callId: 'r1' }),
    ev('agent.step', { execution: 1, step: 2 }), ev('agent.text', { execution: 1, delta: 'Fixing the assertion next.' }),
    ev('session.idle', { execution: 1, steps: 2, stopReason: 'end_turn', incomplete: true })])
  const runs = incompleteRunsShown([record(1)], state.events, 1)
  const html = renderAgentFeed({ status: feedStatus(state.status), events: state.events, incompleteRuns: runs })
  assert.equal(notices(html, 'feed-incomplete'), 1); assert.match(html, /Some of this activity could not be recorded/); assert.match(html, /Interrupted before a result was received/)
})

test('scope: an older run\'s record is shown only while that run\'s events are shown; a complete new run is not blamed; two shown runs with records give two warnings, never duplicates', () => {
  const run1 = [{ execution: 1 }], run2 = [{ execution: 2 }]
  assert.deepEqual(incompleteRunsShown([record(1)], run2, 2).map((r) => r.execution), [], 'run 1 is no longer on screen')
  assert.deepEqual(incompleteRunsShown([record(1)], [...run1, ...run2], 2).map((r) => r.execution), [1], 'run 1\'s events are still shown: its gap is still evidence')
  assert.deepEqual(incompleteRunsShown([record(2), record(1)], [...run1, ...run2], 2).map((r) => r.execution), [1, 2])
  assert.deepEqual(incompleteRunsShown([record(1)], [{}], undefined).map((r) => r.execution), [1], 'history without run numbers is the first run')
  const html = renderAgentFeed({ status: 'idle', events: [], incompleteRuns: incompleteRunsShown([record(2), record(1)], [...run1, ...run2], 2) })
  assert.equal(notices(html, 'feed-incomplete'), 2)
})

test('the stream\'s own declaration: a terminal event with incomplete:true names its run even when the durable record could not be written; a clean terminal declares nothing; the same run is not warned twice', () => {
  resetClock()
  assert.equal(incompleteRunFromEvent(ev('session.idle', { execution: 1, steps: 1, incomplete: true })), 1)
  assert.equal(incompleteRunFromEvent(ev('session.failed', { execution: 3, error: 'x', incomplete: true })), 3)
  assert.equal(incompleteRunFromEvent(ev('session.idle', { execution: 1, steps: 1 })), undefined)
  assert.equal(incompleteRunFromEvent(ev('agent.step', { execution: 1, incomplete: true })), undefined, 'only terminal events declare')
  const runs = incompleteRunsShown(undefined, [{ execution: 1 }], 1, [1])
  assert.equal(runs.length, 1); assert.equal(runs[0]!.execution, 1)
  assert.equal(incompleteRunsShown([record(1)], [{ execution: 1 }], 1, [1]).length, 1, 'record and declaration for one run are one warning')
  assert.equal(notices(renderAgentFeed({ status: 'idle', events: [], incompleteRuns: runs }), 'feed-incomplete'), 1)
})

test('unrecorded end needs a started run: known start + no end on record while finished → warned; recorded end (even followed by a plan edit) → not; no start on record (legacy history, a fresh voice session whose first idle names no run) → unknown, never warned', () => {
  const idle1 = { execution: 1, type: 'session.idle', sequence: 4, incomplete: false }
  assert.equal(runEndUnrecorded('IDLE', 1, { execution: 1, sequence: 1 }, { '1': idle1 }), false, 'ended; whatever was journaled after changes nothing')
  assert.equal(runEndUnrecorded('IDLE', 1, { execution: 1, sequence: 1 }, undefined), true, 'started, finished, no end on record: lost')
  assert.equal(runEndUnrecorded('IDLE', 1, { execution: 1, sequence: 1 }, { '1': { ...idle1, type: 'agent.finished' } }), false, 'a hot-chained turn ends with agent.finished')
  assert.equal(runEndUnrecorded('IDLE', 2, { execution: 1, sequence: 1 }, { '1': idle1 }), false, 'run 2 never started on record: unknown, not lost')
  assert.equal(runEndUnrecorded('IDLE', 1, undefined, undefined), false, 'fresh voice session: IDLE at execution 1 with no run started → no warning')
  assert.equal(runEndUnrecorded('IDLE', 1, undefined, { '1': idle1 }), false)
  assert.equal(runEndUnrecorded('RUNNING', 1, { execution: 1, sequence: 1 }, undefined), false)
  const html = renderAgentFeed({ status: 'idle', events: [], endUnrecorded: true })
  assert.equal(notices(html, 'feed-end-unrecorded'), 1); assert.doesNotMatch(html, /not affected/)
})

test('a stale snapshot cannot take back observed facts: a heartbeat read before catch-up, delivered after the terminal event, merges by sequence and keeps the end (and the older run\'s end stays beside a clean newer one)', () => {
  type Facts = { id: string; status: 'IDLE'; runStart?: RunStart; runEnd?: RunEnd; runEnds?: RunEnds }
  const base: Facts = { id: 's', status: 'IDLE' }
  const observed: Facts = { ...base, runStart: { execution: 2, sequence: 5 }, runEnd: { execution: 2, type: 'session.idle', sequence: 8, incomplete: false }, runEnds: { '1': { execution: 1, type: 'agent.finished', sequence: 4, incomplete: true } } }
  const stale: Facts = { ...base, runStart: { execution: 2, sequence: 5 }, runEnds: { '1': { execution: 1, type: 'agent.finished', sequence: 4, incomplete: true } } }   // read before the end was journaled
  const merged = mergeSessionEvidence(observed, stale)
  assert.equal(merged.runEnd?.sequence, 8); assert.equal(merged.runEnds?.['2']?.sequence, 8); assert.equal(merged.runEnds?.['1']?.incomplete, true)
  assert.equal(runEndUnrecorded('IDLE', 2, merged.runStart, merged.runEnds), false, 'no revived false warning')
  const newer = mergeSessionEvidence(observed, { ...base, runStart: { execution: 3, sequence: 9 } })
  assert.equal(newer.runStart?.execution, 3); assert.equal(newer.runEnds?.['2']?.sequence, 8, 'a newer snapshot adds; it does not erase')
})

test('mixed thinking and activity rows carry their run: later thinking is not read as legacy first-run history, so an older gap is not kept alive by it', () => {
  resetClock()
  const state = play([ev('session.running', { execution: 2 }), ev('agent.step', { execution: 2, step: 1 }), ev('agent.thinking', { execution: 2, delta: 'Looking at the failing test…' }),
    ev('agent.tool_call', { execution: 2, name: 'run_command', input: { command: 'npm test' }, callId: 'r2' }), ev('agent.tool_result', { execution: 2, callId: 'r2', name: 'run_command', isError: false, text: 'ok' }),
    ev('session.idle', { execution: 2, steps: 1, stopReason: 'end_turn' })])
  assert.ok(state.events.length >= 2); for (const row of state.events) assert.equal(row.execution, 2, `${row.title} belongs to run 2`)
  assert.deepEqual(incompleteRunsShown([record(1)], state.events, 2), [], 'run 1 is not on screen: no warning for it')
  assert.deepEqual(incompleteRunsShown([record(2)], state.events, 2).map((r) => r.execution), [2])
})

test('live terminal fact: the stream\'s terminal event yields the run end the server wrote, so a clean end is known at once (no stale inference until reload); non-terminal events yield none', () => {
  resetClock()
  const idle = ev('session.idle', { execution: 3, steps: 2, stopReason: 'end_turn' })
  assert.deepEqual(runEndFromEvent(idle), { execution: 3, type: 'session.idle', sequence: 1, incomplete: false })
  assert.equal(runEndFromEvent(ev('session.failed', { execution: 3, error: 'x', incomplete: true }))?.incomplete, true)
  assert.equal(runEndFromEvent(ev('agent.text', { execution: 3, delta: 'x' })), undefined); assert.equal(runEndFromEvent(ev('session.idle', { steps: 1 })), undefined, 'no run number, no fact')
  const end3 = runEndFromEvent(idle)!; assert.equal(runEndUnrecorded('IDLE', 3, { execution: 3, sequence: 0 }, { '3': end3 }), false)
})

test('the warning says what could not be recorded and that the gap is unknown — never that the work was unaffected', () => {
  const runs = [{ ...record(1), lastType: 'agent.tool_result' }, { ...record(2), lastType: 'worker.interrupted' }, { ...record(3), lastType: 'session.idle' }, { ...record(4), lastType: 'terminal' }]
  const html = renderAgentFeed({ status: 'idle', events: [], incompleteRuns: runs })
  assert.equal(notices(html, 'feed-incomplete'), 4); assert.doesNotMatch(html, /not affected/)
  assert.match(html, /command or result of this run did not reach the record/); assert.match(html, /worker running this stopped before it could record/); assert.match(html, /end of this run did not reach the record/); assert.match(html, /At least one step of this run did not reach the record/)
  assert.ok((html.match(/is not known from this timeline/g) ?? []).length >= 4)
})

test('warnings are per session and account: the same run number elsewhere means nothing here — the scoped state (records, declared runs) is what is shown, and nothing is carried by number alone', () => {
  // The hook clears `incompleteRuns` with the rest of its scoped state on a session/user change and on a stream reset; what remains is what this session\'s own records and events declare.
  assert.deepEqual(incompleteRunsShown(undefined, [{ execution: 1 }], 1, []), [], 'a clean session with run 1 shows no warning even though another session\'s run 1 had one')
  assert.deepEqual(incompleteRunsShown([record(1)], [{ execution: 1 }], 1, []).map((r) => r.execution), [1], 'this session\'s own record does')
})

test('snapshot-only declaration: a run whose recorded end says incomplete raises the warning even when the marker was never written and the stream did not replay the terminal event; a lost start is named as a start, not as a missing end', () => {
  const rows = [{ execution: 1 }, { execution: 2 }]
  const ends = { '1': { execution: 1, type: 'agent.finished', sequence: 4, incomplete: true }, '2': { execution: 2, type: 'session.idle', sequence: 9, incomplete: false } }
  assert.deepEqual(incompleteRunsShown(undefined, rows, 2, [], ends).map((run) => run.execution), [1])
  assert.equal(incompleteRunsShown(undefined, rows, 2, [], undefined).length, 0)
  assert.equal(incompleteRunsShown([{ execution: 1, lost: 2, lastType: 'agent.tool_result', since: 'x' }], rows, 2, [1], ends).length, 1, 'record, stream declaration and snapshot end for the same run: one warning')
  assert.match(incompleteDescription({ execution: 1, lost: 1, lastType: 'session.running', since: '' }), /^The start of this run did not reach the record;/)
  assert.match(incompleteDescription({ execution: 1, lost: 1, lastType: 'session.idle', since: '' }), /^The end of this run did not reach the record;/)
  assert.match(incompleteDescription({ execution: 1, lost: 1, lastType: 'agent.finished', since: '' }), /^The end of this run did not reach the record;/)
  assert.match(incompleteDescription({ execution: 1, lost: 1, lastType: 'session.plan_updated', since: '' }), /^At least one command or result/)
  for (const type of ['session.running', 'session.idle', 'terminal', 'worker.interrupted', 'agent.tool_result']) assert.match(incompleteDescription({ execution: 1, lost: 1, lastType: type, since: '' }), /is not known from this timeline\.$/)
})
