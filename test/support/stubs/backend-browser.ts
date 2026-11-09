/** The backend client double: each call awaits a gate the test opens, so completions land exactly when the scenario says. */
export type Gate = { open: () => void; opened: Promise<void> }
export const gate = (): Gate => { let open!: () => void; const opened = new Promise<void>((resolve) => { open = resolve }); return { open, opened } }
export const backend = {
  /** One gate per `acceptInvitation` call, in call order: the test decides which completion lands, and when. */
  acceptGates: [] as Gate[],
  calls: [] as string[],
  reset() { backend.acceptGates = []; backend.calls = [] },
  client: {
    async me() { const uid = (await import('./firebase')).auth.currentUser?.uid ?? 'nobody'; backend.calls.push(`me:${uid}`); return { uid, email: `${uid}@example.test`, emailVerified: true, projectCount: 0, plan: { key: 'free', name: 'Free' }, workspaces: [{ id: uid, kind: 'personal', name: 'Personal', role: 'owner' }, { id: 'org1', kind: 'organisation', name: 'Acme', role: 'member', slug: 'acme' }], capabilities: {}, closing: null } },
    async usage() { const uid = (await import('./firebase')).auth.currentUser?.uid ?? 'nobody'; return { uid, meters: [] } },
    async acceptInvitation(orgId: string, token: string) { backend.calls.push(`accept:${orgId}:${token.length}`); const opened = gate(); backend.acceptGates.push(opened); await opened.opened; return { id: orgId, name: 'Acme', slug: 'acme', role: 'member', memberCount: 2, seats: 2, createdAt: new Date().toISOString() } },
  },
}
export const currentBackend = () => backend.client
