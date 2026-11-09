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
