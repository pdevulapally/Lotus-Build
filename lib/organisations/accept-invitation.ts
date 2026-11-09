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
 * left and comes back observes it without submitting the single-use token again. Readiness does not belong to the
 * operation: it is a fact about *now* — is this organisation the selected workspace of the signed-in account — so
 * every page that attaches to an accepted invitation confirms it afresh (account refresh, then selection), under
 * its own refresh and selection, fenced by the principal that started and by its staying attached across each
 * await. A readiness confirmed earlier, before the person went to another organisation and back, is history and is
 * never shown as current. A confirmation in flight is shared by a StrictMode re-attach; one that fails is kept as
 * the outcome to retry on request, never re-run behind the person's back.
 */
type Listener = (outcome: AcceptOutcome) => void
interface Operation {
  readonly startedBy: string
  outcome?: AcceptOutcome
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

/** Confirms, for the pages attached now, that the organisation is the selected workspace: pending, then ready or the failure. */
function confirmReady<Workspace extends { id: string }>(operation: Operation, page: Continuations<Workspace>): void {
  if (operation.continuing !== undefined || operation.outcome?.kind !== 'joined') return
  const joined = { id: operation.outcome.id, name: operation.outcome.name }
  const live = () => page.principal() === operation.startedBy && operation.listeners.size > 0
  reportTo(operation)({ kind: 'joined', ...joined, workspace: 'pending' })
  operation.continuing = makeReady(joined, { ...page, report: reportTo(operation) }, live)
    .catch(() => undefined)
    .finally(() => { operation.continuing = undefined })
}

export function attachAcceptance<Workspace extends { id: string }>(
  key: string,
  start: Omit<AcceptInvitationDeps<Workspace>, 'report'>,
  listener: Listener,
): () => void {
  let operation = operations.get(key)
  const fresh = operation === undefined
  if (operation === undefined) { operation = { startedBy: start.principal(), listeners: new Set() }; operations.set(key, operation) }
  // Attach before starting: the operation reads its liveness through its listeners from the first instruction.
  operation.listeners.add(listener)
  // Returning to an accepted invitation confirms the selection afresh (shared with a confirmation already in
  // flight): the listener hears pending, then ready or the failure — never a readiness recorded earlier as current.
  const returning = !fresh && operation.outcome?.kind === 'joined' && operation.continuing === undefined
  if (operation.outcome !== undefined && !returning) listener(operation.outcome)
  if (fresh) {
    const created = operation
    const attached = () => created.listeners.size > 0
    let skipped = false
    const report = reportTo(created)
    void acceptInvitation({
      ...start,
      refresh: () => { if (attached()) return start.refresh(); skipped = true; return Promise.resolve(undefined) },
      select: (id, available) => { if (attached()) return start.select(id, available); skipped = true; return Promise.resolve() },
      // A readiness reached with nobody attached is not readiness: the refresh and selection were skipped.
      report: (outcome) => report(outcome.kind === 'joined' && outcome.workspace === 'ready' && skipped ? { ...outcome, workspace: 'pending' } : outcome),
    }).catch(() => undefined)
  } else if (returning) {
    confirmReady(operation, start)
  }
  const attached = operation
  return () => { attached.listeners.delete(listener) }
}

/** Confirms readiness again for an accepted invitation — the token is never re-sent. */
export function retryJoin<Workspace extends { id: string }>(key: string, page: Continuations<Workspace>): void {
  const operation = operations.get(key)
  if (operation !== undefined) confirmReady(operation, page)
}

/** Test seam: forget every operation (a fresh page load has none). */
export const resetAcceptances = (): void => { operations.clear() }
