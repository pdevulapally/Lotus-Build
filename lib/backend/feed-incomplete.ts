import type { SessionEvent } from './client'

/**
 * What the feed may claim about completeness, from the server's durable facts and the stream it saw. The server keeps
 * one `feedIncomplete` record per run and never erases it; the terminal event of a run that lost an event carries
 * `incomplete: true`; the session's `lastEvent` says what was journaled last. A run is warned about only while its
 * events are shown (or it is the current run), so a warning never outlives the history it is about, and a complete new
 * run is not blamed for an older gap.
 */
export interface FeedIncompleteRun { readonly execution: number; readonly lost: number; readonly lastType: string; readonly since: string }
export interface LastJournaledEvent { readonly type: string; readonly sequence: number; readonly execution?: number }

/** Events that end a run: the session's terminal states, and agent.finished, which closes every turn — hot-chained ones included. */
export const terminalEventTypes: ReadonlySet<string> = new Set(['session.idle', 'session.queued', 'session.stopped', 'session.failed', 'agent.finished'])

export const feedIncompleteCopy = {
  title: 'Some of this activity could not be recorded',
  unrecordedEnd: 'The end of this run was not recorded',
  unrecordedEndDescription: 'The session has finished, but no end is on record for this run: its last steps, and whatever they changed, are not known from this timeline.',
} as const

/** The run a terminal event declares incomplete, when it does. */
export function incompleteRunFromEvent(event: SessionEvent): number | undefined {
  if (!terminalEventTypes.has(event.type) || event.data.incomplete !== true) return undefined
  return typeof event.data.execution === 'number' ? event.data.execution : undefined
}

export function incompleteRunsShown(
  records: readonly FeedIncompleteRun[] | undefined,
  events: readonly { execution?: number | undefined }[],
  currentExecution: number | undefined,
  declaredByStream: readonly number[] = [],
): FeedIncompleteRun[] {
  const shown = new Set<number>()
  for (const event of events) if (event.execution !== undefined) shown.add(event.execution)
  if (currentExecution !== undefined) shown.add(currentExecution)
  // Events without a run number belong to the earliest history the server still streams: count them as the first run.
  if (events.some((event) => event.execution === undefined)) shown.add(1)
  const byRun = new Map<number, FeedIncompleteRun>()
  for (const record of records ?? []) if (shown.has(record.execution)) byRun.set(record.execution, record)
  // A terminal event's own declaration counts even when the durable record could not be written.
  for (const execution of declaredByStream) if (shown.has(execution) && !byRun.has(execution)) byRun.set(execution, { execution, lost: 1, lastType: 'terminal', since: '' })
  return [...byRun.values()].sort((a, b) => a.execution - b.execution)
}

export interface RunEnd { readonly execution: number; readonly type: string; readonly sequence: number; readonly incomplete: boolean }

export interface RunStart { readonly execution: number; readonly sequence: number }
export type RunEnds = Readonly<Record<string, RunEnd>>

/**
 * True only when a run is known to have started and no end is on record for it while the session has finished. A
 * session with no start on record (history from before this was recorded, a fresh voice session whose first idle
 * names no run) is unknown, not lost — nothing is warned about. Judged from durable per-run facts, never inferred.
 */
export function runEndUnrecorded(status: string, execution: number | undefined, runStart: RunStart | undefined, runEnds: RunEnds | undefined): boolean {
  if (!['IDLE', 'STOPPED', 'FAILED'].includes(status) || execution === undefined) return false
  if (runStart === undefined || runStart.execution !== execution) return false
  return runEnds?.[String(execution)] === undefined
}

/** Server facts observed on the stream are evidence a later snapshot cannot take back: a snapshot read before catch-up
 * and delivered after a terminal event must not revive a warning the terminal event already answered. Facts merge by sequence. */
export function mergeSessionEvidence<T extends { runStart?: RunStart; runEnd?: RunEnd; runEnds?: RunEnds }>(current: T | null, next: T): T {
  if (current === null) return next
  const runStart = [current.runStart, next.runStart].filter((x): x is RunStart => x !== undefined).sort((x, y) => y.sequence - x.sequence)[0]
  const ends: Record<string, RunEnd> = { ...(current.runEnds ?? {}), ...(current.runEnd ? { [String(current.runEnd.execution)]: current.runEnd } : {}) }
  for (const end of [...Object.values(next.runEnds ?? {}), ...(next.runEnd ? [next.runEnd] : [])]) {
    const known = ends[String(end.execution)]; if (known === undefined || end.sequence >= known.sequence) ends[String(end.execution)] = end
  }
  const runEnd = Object.values(ends).sort((x, y) => y.sequence - x.sequence)[0]
  return { ...next, ...(runStart ? { runStart } : {}), ...(runEnd ? { runEnd } : {}), ...(Object.keys(ends).length > 0 ? { runEnds: ends } : {}) }
}

/** The end a terminal event records for its run, as the server will have written it. */
export function runEndFromEvent(event: SessionEvent): RunEnd | undefined {
  if (!terminalEventTypes.has(event.type) || typeof event.data.execution !== 'number') return undefined
  const sequence = Number((event.id ?? '').split('-')[1])
  return { execution: event.data.execution, type: event.type, sequence: Number.isSafeInteger(sequence) ? sequence : 0, incomplete: event.data.incomplete === true }
}

/** What could not be recorded, by the kind of the last lost event — and that what happened in the gap is unknown. */
export function incompleteDescription(run: FeedIncompleteRun): string {
  const what = run.lastType === 'worker.interrupted' ? 'The worker running this stopped before it could record what it did last;'
    : run.lastType.startsWith('session.') ? 'The end of this run did not reach the record;'
    : run.lastType === 'terminal' ? 'At least one step of this run did not reach the record;'
    : 'At least one command or result of this run did not reach the record;'
  return `${what} what happened in that gap — including anything it may have changed — is not known from this timeline.`
}
