/**
 * Accepting an invitation, fenced to the signed-in principal (`uid#authEpoch`) that started it: every
 * continuation — the server's answer, the account refresh, reporting, selecting the organisation — runs only
 * while that principal is still the one signed in. Alice's delayed acceptance never refreshes, reports or
 * selects anything for Bob, nor for Alice signed in again (a new epoch) after signing out.
 */
export type AcceptOutcome = { kind: 'joined'; name: string } | { kind: 'failed'; reason: unknown }

export interface AcceptInvitationDeps<Workspace extends { id: string }> {
  readonly principal: () => string
  readonly accept: () => Promise<{ id: string; name: string }>
  readonly refresh: () => Promise<{ workspaces: readonly Workspace[] } | undefined>
  readonly select: (id: string, available?: readonly Workspace[]) => Promise<void>
  readonly report: (outcome: AcceptOutcome) => void
}

export async function acceptInvitation<Workspace extends { id: string }>(deps: AcceptInvitationDeps<Workspace>): Promise<void> {
  const started = deps.principal()
  const live = () => deps.principal() === started
  try {
    const organisation = await deps.accept()
    if (!live()) return
    const fresh = await deps.refresh()
    if (!live()) return
    deps.report({ kind: 'joined', name: organisation.name })
    await deps.select(organisation.id, fresh?.workspaces).catch(() => undefined)
  } catch (reason) {
    if (!live()) return
    deps.report({ kind: 'failed', reason })
  }
}

/**
 * One acceptance per (principal, organisation, token), held outside any component. A React StrictMode
 * replay (setup → cleanup → setup) or a remount re-attaches to the same in-flight operation — the invitation is
 * submitted once — while a different invitation, or the same one under a new principal, is its own operation.
 * An attachment is only a listener: detaching it (effect cleanup) suppresses *reporting* into that component and
 * nothing else; the operation's own continuations stay fenced by the live principal as before. A listener that
 * attaches after the operation finished receives its outcome, so a replay after completion still shows it.
 */
interface Operation { outcome?: AcceptOutcome; readonly listeners: Set<(outcome: AcceptOutcome) => void> }
const operations = new Map<string, Operation>()

export const acceptanceKey = (principal: string, organisationId: string, token: string): string => `${principal}\u0000${organisationId}\u0000${token}`

export function attachAcceptance<Workspace extends { id: string }>(
  key: string,
  start: Omit<AcceptInvitationDeps<Workspace>, 'report'>,
  listener: (outcome: AcceptOutcome) => void,
): () => void {
  let operation = operations.get(key)
  const fresh = operation === undefined
  if (operation === undefined) { operation = { listeners: new Set() }; operations.set(key, operation) }
  // Attach before starting: the operation reads its liveness through its listeners from the first instruction.
  operation.listeners.add(listener)
  if (operation.outcome !== undefined) listener(operation.outcome)
  if (fresh) {
    const created = operation
    void acceptInvitation({
      ...start,
      // Every continuation — refresh, selection, reporting — runs only while this operation is still the one
      // some page is attached to. A page that moved to another invitation (query change) detaches, and this
      // operation's late completion then changes nothing, however the server answered. A StrictMode replay
      // detaches and re-attaches within one commit, before any continuation can observe the gap.
      principal: () => (created.listeners.size > 0 ? start.principal() : ''),
      report: (outcome) => { created.outcome = outcome; for (const listen of [...created.listeners]) listen(outcome) },
    })
  }
  const attached = operation
  return () => { attached.listeners.delete(listener) }
}

/** Test seam: forget every operation (a fresh page load has none). */
export const resetAcceptances = (): void => { operations.clear() }
