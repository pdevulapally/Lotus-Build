import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptanceKey, attachAcceptance, resetAcceptances, acceptInvitation, type AcceptOutcome } from '../lib/organisations/accept-invitation'

const gate = () => { let open!: () => void; const opened = new Promise<void>((resolve) => { open = resolve }); return { open, opened } }
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

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
  assert.deepEqual(h.reports, [{ kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'pending' }, { kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'ready' }], 'accepted is reported first, ready only after the refresh and the selection')
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
  assert.deepEqual(h.reports, [{ kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'pending' }], 'the acceptance was reported while Alice was still the principal; readiness never is'); assert.deepEqual(h.selected, [])
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
  assert.deepEqual(replay, [{ kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'pending' }, { kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'ready' }])
  const late: AcceptOutcome[] = []; attachAcceptance(key, start, (o) => late.push(o)); await settle(); await settle()
  assert.deepEqual(late, [{ kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'pending' }, { kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'ready' }], 'a listener attaching after completion gets the accepted answer and a fresh confirmation, not the earlier readiness')
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

test('a join that settled with no page attached owes its refresh and selection: the page that attaches next runs them once (a StrictMode double attach does not run them twice), under its own refresh/select, and a page that detaches before the refresh answers leaves them owed for the next one', async () => {
  resetAcceptances()
  const accepted = gate(); let refreshes = 0; const selected: string[] = []
  const start = { principal: () => 'alice#1', accept: async () => { await accepted.opened; return { id: 'org-1', name: 'Acme' } }, refresh: async () => { refreshes++; return { workspaces: [{ id: 'org-1' }] } }, select: async (id: string) => { selected.push(id) } }
  const key = acceptanceKey('alice#1', 'org-1', 'tok')
  const detach = attachAcceptance(key, start, () => undefined)
  detach()                                                      // the page moved on before the server answered
  accepted.open(); await settle(); await settle()
  assert.equal(refreshes, 0); assert.deepEqual(selected, [], 'nothing runs for a page that is not there')
  // The page comes back (StrictMode: attach, detach, attach): one refresh, one selection, from the returning page's own deps.
  const back: AcceptOutcome[] = []
  const again = { ...start, refresh: async () => { refreshes++; return { workspaces: [{ id: 'org-1' }] } } }
  const first = attachAcceptance(key, again, (o) => back.push(o)); first()
  const second = attachAcceptance(key, again, (o) => back.push(o))
  await settle(); await settle()
  assert.ok(back.length >= 2 && back.every((o) => o.kind === 'joined' && o.id === 'org-1'), 'both attachments observe the retained outcome without a resubmission')
  assert.deepEqual(back.at(-1), { kind: 'joined', id: 'org-1', name: 'Acme', workspace: 'ready' }, 'and the last word is ready')
  assert.equal(refreshes, 1, 'the owed refresh ran once'); assert.deepEqual(selected, ['org-1'], 'the owed selection ran once')
  second()
  // Attaching again later is a return: readiness is confirmed afresh (the selection may have moved meanwhile), still without a resubmission.
  const third = attachAcceptance(key, again, () => undefined); await settle(); await settle(); third()
  assert.equal(refreshes, 2); assert.deepEqual(selected, ['org-1', 'org-1'])
})

test('the owed continuation is fenced like every other: a page that detaches while the refresh is in flight gets no selection, and the next page runs the refresh again', async () => {
  resetAcceptances()
  const refreshed = gate(); let refreshes = 0; const selected: string[] = []
  const start = { principal: () => 'alice#1', accept: async () => ({ id: 'org-1', name: 'Acme' }), refresh: async () => { refreshes++; await refreshed.opened; return { workspaces: [{ id: 'org-1' }] } }, select: async (id: string) => { selected.push(id) } }
  const key = acceptanceKey('alice#1', 'org-1', 'tok')
  const detach = attachAcceptance(key, start, () => undefined); detach(); await settle(); await settle()
  assert.equal(refreshes, 0, 'settled detached: nothing ran')
  const back = attachAcceptance(key, start, () => undefined); await settle()
  assert.equal(refreshes, 1, 'the returning page starts the owed refresh')
  back(); refreshed.open(); await settle(); await settle()
  assert.deepEqual(selected, [], 'it left before the refresh answered: no selection for a page that is gone')
  const again = attachAcceptance(key, start, () => undefined); await settle(); await settle()
  assert.equal(refreshes, 2); assert.deepEqual(selected, ['org-1'], 'the next page is refreshed and switched'); again()
})
