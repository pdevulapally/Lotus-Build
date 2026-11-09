/** The backend client double: each call awaits a gate the test opens, so completions land exactly when the scenario says. */
export type Gate = { open: () => void; opened: Promise<void> }
export const gate = (): Gate => { let open!: () => void; const opened = new Promise<void>((resolve) => { open = resolve }); return { open, opened } }
const organisationOf = (orgId: string) => ({ id: orgId, name: orgId === 'org2' ? 'Beta' : 'Acme', slug: orgId === 'org2' ? 'beta' : 'acme', role: 'owner' as const, memberCount: 3, seats: 3, createdAt: '2026-01-01T00:00:00.000Z' })
const teamsSubscription = { planKey: 'teams', planName: 'Teams', status: 'ACTIVE', seats: 3, currentPeriodEnd: '2026-12-01T00:00:00.000Z', cancelAtPeriodEnd: false }
export const backend = {
  /** What the next `reconcileSeats` answers; the test sets it per scenario. The call awaits `reconcileGate`. */
  reconcileAnswer: { subscription: teamsSubscription, pending: null } as Record<string, unknown>,
  reconcileGate: gate(),
  /** One gate per `acceptInvitation` call, in call order: the test decides which completion lands, and when. */
  acceptGates: [] as Gate[],
  calls: [] as string[],
  reset() { backend.acceptGates = []; backend.calls = []; backend.reconcileGate = gate(); backend.reconcileAnswer = { subscription: teamsSubscription, pending: null } },
  client: {
    async me() { const uid = (await import('./firebase')).auth.currentUser?.uid ?? 'nobody'; backend.calls.push(`me:${uid}`); return { uid, email: `${uid}@example.test`, emailVerified: true, projectCount: 0, plan: { key: 'free', name: 'Free' }, workspaces: [{ id: uid, kind: 'personal', name: 'Personal', role: 'owner' }, { id: 'org1', kind: 'organisation', name: 'Acme', role: 'owner', slug: 'acme' }, { id: 'org2', kind: 'organisation', name: 'Beta', role: 'owner', slug: 'beta' }], capabilities: {}, closing: null } },
    async usage() { const uid = (await import('./firebase')).auth.currentUser?.uid ?? 'nobody'; return { uid, meters: [] } },
    async plans() { return { plans: [] } },
    async subscription() { return { subscription: null } },
    async organisation(orgId: string) { backend.calls.push(`organisation:${orgId}`); return organisationOf(orgId) },
    async organisationMembers() { return { members: [] } },
    async organisationInvitations() { return { invitations: [] } },
    async organisationBilling(orgId: string) { backend.calls.push(`billing:${orgId}`); return { subscription: teamsSubscription, memberCount: 3, plans: [] } },
    async reconcileSeats(orgId: string) { backend.calls.push(`reconcile:${orgId}`); await backend.reconcileGate.opened; return backend.reconcileAnswer },
    async acceptInvitation(orgId: string, token: string) { backend.calls.push(`accept:${orgId}:${token.length}`); const opened = gate(); backend.acceptGates.push(opened); await opened.opened; return { id: orgId, name: orgId === 'org2' ? 'Beta' : 'Acme', slug: orgId === 'org2' ? 'beta' : 'acme', role: 'member', memberCount: 2, seats: 2, createdAt: new Date().toISOString() } },
  },
}
export const currentBackend = () => backend.client
