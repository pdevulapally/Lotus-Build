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

export const terminalEventTypes: ReadonlySet<string> = new Set(['session.idle', 'session.queued', 'session.stopped', 'session.failed'])

export const feedIncompleteCopy = {
  title: 'Some of this activity could not be recorded',
  description: 'This timeline is missing at least one step of that run, so it is not the complete record. The work itself was not affected.',
  unrecordedEnd: 'The end of this run was not recorded',
  unrecordedEndDescription: 'The run finished, but its last steps did not reach the record, so this timeline may be incomplete.',
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

/** True when the session has finished but the last journaled event is not the end of its current run. */
export function runEndUnrecorded(status: string, execution: number | undefined, lastEvent: LastJournaledEvent | undefined): boolean {
  if (!['IDLE', 'STOPPED', 'FAILED'].includes(status) || lastEvent === undefined) return false
  if (!terminalEventTypes.has(lastEvent.type)) return true
  return execution !== undefined && lastEvent.execution !== undefined && lastEvent.execution !== execution
}
