type Stage = 'submit' | 'acknowledged' | 'accepted' | 'navigation' | 'workspace' | 'connected' | 'modelReceived' | 'feedVisible'
type Emit = (name: string, start: number, end: number) => void
const intervals: readonly [Stage, Stage, string][] = [
  ['submit', 'acknowledged', 'submit-to-acknowledgment'],
  ['submit', 'accepted', 'submit-to-acceptance'],
  ['submit', 'navigation', 'submit-to-navigation'],
  ['navigation', 'workspace', 'navigation-to-workspace'],
  ['navigation', 'connected', 'navigation-to-sse'],
  ['modelReceived', 'feedVisible', 'model-event-to-feed'],
]

/** Local User Timing only. Names contain no account/session IDs or content. */
export function latencyTrace(now: () => number = () => performance.now(), emit: Emit = (name, start, end) => {
  performance.measure(`lotus.${name}`, { start, end })
  const entries = performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('lotus.'))
  if (entries.length > 200) performance.clearMeasures(entries[0].name)
}) {
  const stages = new Map<Stage, number>()
  const measured = new Set<string>()
  const journal = new Map<string, number>()
  const measureJournal = (name: string, start: number | undefined, end: number) => {
    if (start === undefined || end < start || measured.has(name)) return
    measured.add(name)
    // Duration from the same server event journal, never from a client clock.
    emit(`journal.${name}`, 0, end - start)
  }
  return {
    mark(stage: Stage) {
      if (stage === 'feedVisible' && !stages.has('modelReceived')) return
      if (stages.has(stage)) return
      stages.set(stage, now())
      for (const [from, to, name] of intervals) {
        const start = stages.get(from); const end = stages.get(to)
        if (start !== undefined && end !== undefined && end >= start && !measured.has(name)) {
          measured.add(name); emit(name, start, end)
        }
      }
    },
    event(type: string, id: string) {
      const time = Number(id.split('-')[0])
      if (!Number.isFinite(time)) return
      if (type === 'session.accepted') journal.set('accepted', time)
      if (type === 'session.running' && !journal.has('runner')) {
        journal.set('runner', time)
        measureJournal('acceptance-to-runner', journal.get('accepted'), time)
      }
      if (type === 'agent.step') measureJournal('runner-to-model-step', journal.get('runner'), time)
      if (type === 'agent.tool_call' && !journal.has('tool')) journal.set('tool', time)
      if (type === 'sandbox.started') measureJournal('tool-to-sandbox-acquired', journal.get('tool'), time)
    },
  }
}

type Trace = ReturnType<typeof latencyTrace>
const traces = new Map<string, { trace: Trace; expires: number }>()
const key = (uid: string, sessionId: string) => JSON.stringify([uid, sessionId])
export function acceptLatencyTrace(uid: string, sessionId: string, trace: Trace, createdAt: string) {
  trace.mark('accepted')
  trace.event('session.accepted', `${Date.parse(createdAt)}-0`)
  traces.set(key(uid, sessionId), { trace, expires: performance.now() + 30 * 60_000 })
  if (traces.size > 32) traces.delete(traces.keys().next().value!)
}
export function sessionLatency(uid: string, sessionId: string): Trace {
  const scope = key(uid, sessionId)
  const saved = traces.get(scope)
  if (saved && saved.expires > performance.now()) return saved.trace
  const trace = latencyTrace()
  traces.set(scope, { trace, expires: performance.now() + 30 * 60_000 })
  if (traces.size > 32) traces.delete(traces.keys().next().value!)
  return trace
}
