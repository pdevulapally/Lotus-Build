/**
 * Accepting an invitation, fenced to the signed-in principal (`uid#authEpoch`) that started it: every
 * continuation — the server's answer, the account refresh, reporting, selecting the organisation — runs only
 * while that principal is still the one signed in. Alice's delayed acceptance never refreshes, reports or
 * selects anything for Bob, nor for Alice signed in again (a new epoch) after signing out.
 */
export type AcceptOutcome = { kind: 'joined'; id: string; name: string } | { kind: 'failed'; reason: unknown }

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
    deps.report({ kind: 'joined', id: organisation.id, name: organisation.name })
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
 *
 * The server's answer belongs to the operation: it is recorded whether or not a page is attached, so a page that
 * left and comes back observes it without submitting the single-use token again. The side effects of a join — the
 * account refresh and selecting the organisation — belong to whichever page is attached: they run when the join
 * settles while a page is attached, and otherwise are *owed* and run when a page attaches again (that page's own
 * continuation, under its own refresh and selection, still fenced by the principal that started and by its staying
 * attached across each await). A page that moved to another invitation therefore gets nothing from the late
 * completion of the one it left, while a page returning to a settled join is refreshed and switched exactly once.
 */
type Listener = (outcome: AcceptOutcome) => void
interface Operation {
  readonly startedBy: string
  outcome?: AcceptOutcome
  /** A join settled with no page attached: its refresh and selection have not run for anyone yet. */
  owed: boolean
  continuing?: Promise<void>
  readonly listeners: Set<Listener>
}
const operations = new Map<string, Operation>()

export const acceptanceKey = (principal: string, organisationId: string, token: string): string => `${principal}\u0000${organisationId}\u0000${token}`

type Continuations<Workspace extends { id: string }> = Pick<AcceptInvitationDeps<Workspace>, 'principal' | 'refresh' | 'select'>

async function continueJoin<Workspace extends { id: string }>(operation: Operation, id: string, page: Continuations<Workspace>): Promise<void> {
  const live = () => page.principal() === operation.startedBy && operation.listeners.size > 0
  if (!live()) return
  const fresh = await page.refresh()
  if (!live()) return
  await page.select(id, fresh?.workspaces).catch(() => undefined)
  operation.owed = false
}

export function attachAcceptance<Workspace extends { id: string }>(
  key: string,
  start: Omit<AcceptInvitationDeps<Workspace>, 'report'>,
  listener: Listener,
): () => void {
  let operation = operations.get(key)
  const fresh = operation === undefined
  if (operation === undefined) { operation = { startedBy: start.principal(), owed: false, listeners: new Set() }; operations.set(key, operation) }
  // Attach before starting: the operation reads its liveness through its listeners from the first instruction.
  operation.listeners.add(listener)
  if (operation.outcome !== undefined) listener(operation.outcome)
  if (fresh) {
    const created = operation
    const attached = () => created.listeners.size > 0
    void acceptInvitation({
      ...start,
      refresh: () => { if (attached()) return start.refresh(); created.owed = true; return Promise.resolve(undefined) },
      select: (id, available) => { if (attached()) return start.select(id, available); created.owed = true; return Promise.resolve() },
      report: (outcome) => { created.outcome = outcome; for (const listen of [...created.listeners]) listen(outcome) },
    })
  } else if (operation.outcome?.kind === 'joined' && operation.owed && operation.continuing === undefined) {
    const settled = operation
    settled.continuing = continueJoin(settled, operation.outcome.id, start).finally(() => { settled.continuing = undefined })
  }
  const attached = operation
  return () => { attached.listeners.delete(listener) }
}

/** Test seam: forget every operation (a fresh page load has none). */
export const resetAcceptances = (): void => { operations.clear() }
