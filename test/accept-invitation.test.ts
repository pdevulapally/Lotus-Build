import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptanceKey, attachAcceptance, resetAcceptances, acceptInvitation, type AcceptOutcome } from '../lib/organisations/accept-invitation'

const gate = () => { let open!: () => void; const opened = new Promise<void>((resolve) => { open = resolve }); return { open, opened } }

function harness(principal: { current: string }) {
  const accepted = gate(), refreshed = gate()
  const reports: AcceptOutcome[] = []
  const selected: { id: string; available?: readonly { id: string }[] }[] = []
  let refreshes = 0
  const run = acceptInvitation({
    principal: () => principal.current,
    accept: async () => { await accepted.opened; return { id: 'org-1', name: 'Acme' } },
    refresh: async () => { refreshes++; await refreshed.opened; return { workspaces: [{ id: 'alice' }, { id: 'org-1' }] } },
    select: async (id, available) => { selected.push({ id, available }) },
    report: (outcome) => reports.push(outcome),
  })
  return { run, accepted, refreshed, reports, selected, refreshes: () => refreshes }
}

test('a normal acceptance reports joined after the refresh and selects the organisation from the refreshed workspaces', async () => {
  const principal = { current: 'alice#1' }
  const h = harness(principal)
  h.accepted.open(); h.refreshed.open()
  await h.run
  assert.deepEqual(h.reports, [{ kind: 'joined', name: 'Acme' }])
  assert.deepEqual(h.selected, [{ id: 'org-1', available: [{ id: 'alice' }, { id: 'org-1' }] }])
})

test('the account switches to Bob while Alice\'s acceptance is in flight: nothing is refreshed, reported or selected for Bob', async () => {
  const principal = { current: 'alice#1' }
  const h = harness(principal)
  principal.current = 'bob#2'
  h.accepted.open(); h.refreshed.open()
  await h.run
  assert.deepEqual(h.reports, []); assert.deepEqual(h.selected, []); assert.equal(h.refreshes(), 0)
})

test('Alice signs out and back in during the refresh: the same uid under a new epoch is not the principal that started, so the late completion selects nothing', async () => {
  const principal = { current: 'alice#1' }
  const h = harness(principal)
  h.accepted.open()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(h.refreshes(), 1, 'the refresh began under the original principal')
  principal.current = 'alice#2'
  h.refreshed.open()
  await h.run
  assert.deepEqual(h.reports, []); assert.deepEqual(h.selected, [])
})

test('a failure that arrives after the principal changed is not reported to the new one; one that arrives for the same principal is', async () => {
  const principal = { current: 'alice#1' }
  const reports: AcceptOutcome[] = []
  const deps = { principal: () => principal.current, refresh: async () => undefined, select: async () => undefined, report: (outcome: AcceptOutcome) => reports.push(outcome) }
  const stale = gate()
  const late = acceptInvitation({ ...deps, accept: async () => { await stale.opened; throw new Error('invitation expired') } })
  principal.current = 'bob#2'
  stale.open(); await late
  assert.equal(reports.length, 0)
  principal.current = 'alice#1'
  await acceptInvitation({ ...deps, accept: async () => { throw new Error('invitation expired') } })
  assert.deepEqual(reports.map((outcome) => outcome.kind), ['failed'])
})

test('the page unmounts (sign-out → ProtectedRoute) while Alice\'s acceptance is in flight, then Bob signs in: the provider-level principal is stale and the cleanup is tripped, so the late completion refreshes, reports and selects nothing', async () => {
  // The provider outlives the page: its principal is what the flow reads, through the page's own cleanup flag.
  const provider = { current: 'alice#1' }
  let mounted = true
  const accepted = gate()
  const reports: AcceptOutcome[] = []; const selected: string[] = []; let refreshes = 0
  const run = acceptInvitation({
    principal: () => (mounted ? provider.current : ''),
    accept: async () => { await accepted.opened; return { id: 'org-1', name: 'Acme' } },
    refresh: async () => { refreshes++; return { workspaces: [{ id: 'org-1' }] } },
    select: async (id) => { selected.push(id) },
    report: (outcome) => reports.push(outcome),
  })
  mounted = false                 // ProtectedRoute unmounted the page during sign-out
  provider.current = ''           // signed out…
  provider.current = 'bob#2'      // …and Bob signed in; a fresh page would mount with its own attempt
  accepted.open(); await run
  assert.equal(refreshes, 0); assert.deepEqual(reports, []); assert.deepEqual(selected, [])
})

test('attaching twice to the same (principal, organisation, token) runs one acceptance; detaching suppresses only that listener; a late attachment receives the outcome', async () => {
  resetAcceptances()
  let accepts = 0
  const accepted = gate()
  const start = { principal: () => 'alice#1', accept: async () => { accepts++; await accepted.opened; return { id: 'org-1', name: 'Acme' } }, refresh: async () => ({ workspaces: [{ id: 'org-1' }] }), select: async () => undefined }
  const first: AcceptOutcome[] = []; const replay: AcceptOutcome[] = []
  const key = acceptanceKey('alice#1', 'org-1', 'tok')
  const detachFirst = attachAcceptance(key, start, (o) => first.push(o))
  detachFirst()                                            // StrictMode cleanup…
  const detachReplay = attachAcceptance(key, start, (o) => replay.push(o))   // …and setup again
  assert.equal(accepts, 1, 'the invitation is submitted once')
  accepted.open(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(first, [], 'the detached listener hears nothing')
  assert.deepEqual(replay, [{ kind: 'joined', name: 'Acme' }])
  const late: AcceptOutcome[] = []; attachAcceptance(key, start, (o) => late.push(o))
  assert.deepEqual(late, [{ kind: 'joined', name: 'Acme' }], 'a listener attaching after completion still gets the outcome')
  detachReplay()
})

test('a different invitation, or the same one under a new principal, is its own operation', async () => {
  resetAcceptances()
  let accepts = 0
  const start = { principal: () => 'alice#1', accept: async () => { accepts++; return { id: 'org-1', name: 'Acme' } }, refresh: async () => undefined, select: async () => undefined }
  attachAcceptance(acceptanceKey('alice#1', 'org-1', 'tok-a'), start, () => undefined)
  attachAcceptance(acceptanceKey('alice#1', 'org-1', 'tok-b'), start, () => undefined)
  attachAcceptance(acceptanceKey('alice#2', 'org-1', 'tok-a'), start, () => undefined)
  assert.equal(accepts, 3)
})
