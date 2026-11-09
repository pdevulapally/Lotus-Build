/**
 * Accepting an invitation, fenced to the signed-in principal (`uid#authEpoch`) that started it: every
 * continuation — the server's answer, the account refresh, reporting, selecting the organisation — runs only
 * while that principal is still the one signed in. Alice's delayed acceptance never refreshes, reports or
 * selects anything for Bob, nor for Alice signed in again (a new epoch) after signing out.
 *
 * Two facts are reported apart: the server *accepted* the invitation (single-use, never re-sent), and the
 * organisation is *ready* as the selected workspace (account refreshed and switched). Until the second is
 * true the page must not send the person into the organisation; if it fails they are told, and may retry it
 * without the token being used again.
 */
export type WorkspaceReadiness = 'pending' | 'ready' | { readonly failed: string }
export type AcceptOutcome = { kind: 'joined'; id: string; name: string; workspace: WorkspaceReadiness } | { kind: 'failed'; reason: unknown }

export interface AcceptInvitationDeps<Workspace extends { id: string }> {
  readonly principal: () => string
  readonly accept: () => Promise<{ id: string; name: string }>
  readonly refresh: () => Promise<{ workspaces: readonly Workspace[] } | undefined>
  readonly select: (id: string, available?: readonly Workspace[]) => Promise<void>
  readonly report: (outcome: AcceptOutcome) => void
}

const describe = (reason: unknown): string => (reason instanceof Error && reason.message !== '' ? reason.message : 'The workspace could not be opened.')

/** Refreshes the account and selects the organisation; reports ready, or the failure, to whoever is listening. */
async function makeReady<Workspace extends { id: string }>(
  joined: { id: string; name: string },
  deps: Pick<AcceptInvitationDeps<Workspace>, 'refresh' | 'select' | 'report'>,
  live: () => boolean,
): Promise<void> {
  try {
    const fresh = await deps.refresh()
    if (!live()) return
    await deps.select(joined.id, fresh?.workspaces)
    if (!live()) return
    deps.report({ kind: 'joined', ...joined, workspace: 'ready' })
  } catch (reason) {
    if (!live()) return
    deps.report({ kind: 'joined', ...joined, workspace: { failed: describe(reason) } })
  }
}

export async function acceptInvitation<Workspace extends { id: string }>(deps: AcceptInvitationDeps<Workspace>): Promise<void> {
  const started = deps.principal()
  const live = () => deps.principal() === started
  let joined: { id: string; name: string }
  try {
    joined = await deps.accept()
  } catch (reason) {
    if (live()) deps.report({ kind: 'failed', reason })
    return
  }
  if (!live()) return
  deps.report({ kind: 'joined', ...joined, workspace: 'pending' })
  await makeReady(joined, deps, live)
}

/**
 * One acceptance per (principal, organisation, token), held outside any component. A React StrictMode
 * replay (setup → cleanup → setup) or a remount re-attaches to the same in-flight operation — the invitation is
 * submitted once — while a different invitation, or the same one under a new principal, is its own operation.
 *
 * The server's answer belongs to the operation: it is recorded whether or not a page is attached, so a page that
 * left and comes back observes it without submitting the single-use token again. Making the workspace ready —
 * the account refresh and selecting the organisation — belongs to whichever page is attached: it runs when the
 * join settles while a page is attached, and otherwise is *owed* and runs when a page attaches again (that page's
 * own continuation, under its own refresh and selection, fenced by the principal that started and by its staying
 * attached across each await). A page that moved to another invitation therefore gets nothing from the late
 * completion of the one it left; a page returning to a settled join is refreshed and switched exactly once; and
 * a failed readiness is kept as the outcome, to be retried on request, never re-run behind the person's back.
 */
type Listener = (outcome: AcceptOutcome) => void
interface Operation {
  readonly startedBy: string
  outcome?: AcceptOutcome
  /** A join settled with no page attached: making the workspace ready has not run for anyone yet. */
  owed: boolean
  continuing?: Promise<void>
  readonly listeners: Set<Listener>
}
const operations = new Map<string, Operation>()

export const acceptanceKey = (principal: string, organisationId: string, token: string): string => `${principal}\u0000${organisationId}\u0000${token}`

type Continuations<Workspace extends { id: string }> = Pick<AcceptInvitationDeps<Workspace>, 'principal' | 'refresh' | 'select'>

const reportTo = (operation: Operation): Listener => (outcome) => {
  operation.outcome = outcome
  for (const listen of [...operation.listeners]) listen(outcome)
}

function continueJoin<Workspace extends { id: string }>(operation: Operation, page: Continuations<Workspace>): void {
  if (operation.continuing !== undefined || operation.outcome?.kind !== 'joined' || operation.outcome.workspace === 'ready') return
  const joined = { id: operation.outcome.id, name: operation.outcome.name }
  const live = () => page.principal() === operation.startedBy && operation.listeners.size > 0
  operation.owed = false
  reportTo(operation)({ kind: 'joined', ...joined, workspace: 'pending' })
  operation.continuing = makeReady(joined, { ...page, report: reportTo(operation) }, live)
    .catch(() => undefined)
    .finally(() => {
      operation.continuing = undefined
      // Neither ready nor failed: the page left mid-way, so readiness is owed to the next one.
      if (operation.outcome?.kind === 'joined' && operation.outcome.workspace === 'pending') operation.owed = true
    })
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
    const report = reportTo(created)
    void acceptInvitation({
      ...start,
      refresh: () => { if (attached()) return start.refresh(); created.owed = true; return Promise.resolve(undefined) },
      select: (id, available) => { if (attached()) return start.select(id, available); created.owed = true; return Promise.resolve() },
      // A readiness reached with nobody attached is not readiness: the refresh and selection were skipped and are owed.
      report: (outcome) => report(outcome.kind === 'joined' && outcome.workspace === 'ready' && created.owed ? { ...outcome, workspace: 'pending' } : outcome),
    }).catch(() => undefined)
  } else if (operation.owed) {
    continueJoin(operation, start)
  }
  const attached = operation
  return () => { attached.listeners.delete(listener) }
}

/** Runs the owed or failed readiness again for an accepted invitation — the token is never re-sent. */
export function retryJoin<Workspace extends { id: string }>(key: string, page: Continuations<Workspace>): void {
  const operation = operations.get(key)
  if (operation !== undefined) continueJoin(operation, page)
}

/** Test seam: forget every operation (a fresh page load has none). */
export const resetAcceptances = (): void => { operations.clear() }
