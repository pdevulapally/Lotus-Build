/**
 * Cross-app check of the composed trees: the real composed lotusbuild-server routes (Fastify, listening on a loopback
 * port, in-memory ledger, auth/Stripe/Redis doubles, real SessionJournal + SessionEvents) driven by this frontend's real
 * `BackendClient` and its schemas, with the feed built by the real reducer steps and warned by `incompleteRunsShown`.
 * Deterministic and offline: no model, no sandbox, no Firebase, no Stripe, no deploy. It proves the client/server
 * contract and the user-visible flow on these trees; it says nothing about provider quality or production readiness.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'


import { BackendClient, BackendError, type SessionEvent } from '../../lib/backend/client'
import { loadSessionSnapshot, sessionEventStatus } from '../../lib/backend/session-snapshot'
import { incompleteRunsShown, runEndUnrecorded } from '../../lib/backend/feed-incomplete'
import { executionLabel } from '../../lib/backend/feed-labels'
import { activity, closeSpokenParagraph, interruptRunningToolEvents, isTerminalStatus, reduceThinking, updateCommandEvent, updateToolStepEvent } from '../../hooks/use-backend-session'
import type { ComputerTimelineEvent } from '../../components/computer/session-types'

/**
 * Where the composed lotusbuild-server checkout is (its dependencies installed): the test is skipped, loudly, without it.
 * Example: LOTUSBUILD_SERVER_DIR=/path/to/lotusbuild-server npm run test:cross-app
 */
const serverDir = process.env.LOTUSBUILD_SERVER_DIR
const load = (path: string) => import(`${serverDir}/${path}`) as Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
// Server-side types are not resolvable from this package; the doubles are structural and cast at the boundary.
type Auth = unknown; type Firestore = unknown; type Transaction = unknown; type Redis = unknown
type Plan = { price: { amountMinor: number; currency: string; interval: string } }
namespace Stripe { export type Price = Record<string, unknown>; export type Subscription = Record<string, unknown>; export type SubscriptionUpdateParams = { items?: { quantity?: number }[] } }
const alice = 'alice', bob = 'bob'
async function composedServer() {
  const { default: Fastify } = await load('node_modules/fastify/fastify.js')
  const { ledger } = await load('test/support/ledger.ts')
  const { registerAuth } = await load('src/auth/plugin.ts')
  const { registerErrorHandler } = await load('src/http/errors.ts')
  const { ResolvedEntitlements } = await load('src/entitlements/service.ts')
  const { parsePlan, parseRegistry } = await load('src/entitlements/schema.ts')
  const { planDocuments, registryDocument } = await load('src/seed/config.ts')
  const { planKeyMetadataField } = await load('src/billing/stripe.ts')
  const { OrganisationService } = await load('src/organisations/service.ts')
  const { registerOrganisationRoutes } = await load('src/organisations/routes.ts')
  const { registerOrganisationBillingRoutes } = await load('src/organisations/billing-routes.ts')
  const { billingAccounts } = await load('src/billing/accounts.ts')
  const { BillingRepository } = await load('src/billing/repository.ts')
  const { ProjectRepository } = await load('src/projects/repository.ts')
  const { registerProjectRoutes } = await load('src/projects/routes.ts')
  const { SessionRepository } = await load('src/sessions/repository.ts')
  const { registerSessionRoutes } = await load('src/sessions/routes.ts')
  const { SessionEvents } = await load('src/sessions/events.ts')
  const registry = parseRegistry(registryDocument as never, 'config/registry')
  const plans: Map<string, Plan> = new Map(planDocuments.map((d: { key: string }) => { const plan = parsePlan(d as never, `plans/${d.key}`, registry); return [plan.key as string, plan as Plan] }))
  const capabilities = new ResolvedEntitlements(new Map([
  ['ai.run', { kind: 'boolean', value: true }], ['platform.web', { kind: 'boolean', value: true }],
  ['ai.model.allowlist', { kind: 'stringList', value: ['model-1'] }], ['ai.effort', { kind: 'string', value: 'standard' }], ['projects.max', { kind: 'number', value: 10 }],
]) as never)
  const resolved = { planKey: 'teams', planName: 'Teams', subscriptionStatus: undefined, capabilities, seats: 2,
  meterLimits: new Map([['builds.started', { hardLimit: 100, includedAllowance: 100, overageEnabled: false }]]), rateLimits: new Map() }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const price = (planKey: string) => { const plan = plans.get(planKey)!; return { id: `price_${planKey}`, lookup_key: `lotusbuild_${planKey}`, unit_amount: plan.price!.amountMinor, currency: plan.price!.currency,
  recurring: { interval: plan.price!.interval }, product: 'prod_1', metadata: { [planKeyMetadataField]: planKey } } as unknown as Stripe.Price }
  const subscriptionOf = (quantity: number) => ({ id: 'sub_1', customer: 'cus_org', status: 'active', cancel_at_period_end: false,
  items: { data: [{ id: 'si_1', price: price('teams'), quantity, current_period_start: nowSeconds - 3600, current_period_end: nowSeconds + 3600 }] } } as unknown as Stripe.Subscription)

  const { db, data } = ledger()
  for (const uid of [alice, bob]) data.set(`users/${uid}`, { uid, email: `${uid}@example.test`, displayName: uid, projectCount: 0, createdAt: new Date(), updatedAt: new Date() })
  const invitations: string[] = []
  const organisations = new OrganisationService(db, { email: { sendVerificationCode: async () => {}, sendOrganisationInvitation: async (m: { acceptUrl: string }) => { invitations.push(new URL(m.acceptUrl).searchParams.get('token')!) } },
    invitationTtlSeconds: 3600, acceptUrl: (orgId: string, token: string) => `https://app.test/invitations?organisation=${orgId}&token=${token}` })
  const entitlements = { forUser: async () => resolved, forWorkspace: async () => resolved } as never
  const configuration = { get: async () => ({ plans, registry: { ...registry, buildMeterKey: 'builds.started', sandboxProviders: new Map([['web', { desktop: { width: 1280, height: 800 } }]]) } }) } as never
  const meter = async (_tx: Transaction, _input: unknown) => ({ meterKey: 'builds.started', consumed: 1, periodStart: new Date() })
  const metering = { consumeIn: meter, recordIn: meter, refundIn: meter, releaseIn: async () => [] } as never
  const users = { readInTransaction: async (_tx: Transaction, uid: string) => ({ uid, email: `${uid}@example.test`, projectCount: 0 }), refFor: (uid: string) => db.doc(`users/${uid}`),
    read: async (uid: string) => ({ uid, email: `${uid}@example.test`, displayName: uid, photoUrl: undefined, projectCount: 0 }) } as never
  const projects = new ProjectRepository(db, users, entitlements)
  const sessions = new SessionRepository(db, projects, entitlements, configuration, metering, 120)
  const bus = new EventEmitter()
  const redis = { publish: async (key: string, payload: string) => { bus.emit('message', key, payload); return 1 } }
  const subscriber = Object.assign(bus, { subscribe: async () => 1, unsubscribe: async () => 0 })
  const events = new SessionEvents(redis as unknown as Redis, subscriber as unknown as Redis, { firestore: db as unknown as Firestore, maxEventBytes: 65536, maxPerSession: 1000, retentionSeconds: 3600, onListenerError: (error: unknown) => { throw error } })
  const stripeCalls: { method: string; args: unknown[] }[] = []
  let live: Stripe.Subscription | undefined = subscriptionOf(2)
  let updateFailsOnce = false
  const stripe = {
    customers: { create: async () => ({ id: 'cus_org' }) },
    subscriptions: {
      list: async () => ({ data: live === undefined ? [] : [live], has_more: false }),
      update: async (...args: unknown[]) => { stripeCalls.push({ method: 'subscriptions.update', args }); if (updateFailsOnce) { updateFailsOnce = false; throw new Error('socket hang up') }
        live = subscriptionOf((args[1] as Stripe.SubscriptionUpdateParams).items![0]!.quantity!); return live },
    },
    prices: { list: async (params: { lookup_keys: string[] }) => ({ data: [price(params.lookup_keys[0]!.replace('lotusbuild_', ''))] }) },
    checkout: { sessions: { create: async () => ({ url: 'https://checkout.test/s' }), list: async () => ({ data: [] }) } },
    billingPortal: { sessions: { create: async () => ({ url: 'https://portal.test/p' }) } },
  }
  const noCache = { read: async () => undefined, beginFill: async () => undefined, write: async () => {}, invalidate: async () => {} } as never
  const billing = new BillingRepository(db, noCache, 3600)
  const app = Fastify({ logger: false })
  registerAuth(app, { verifyIdToken: async (token: string) => {
    if (!['alice', 'bob'].includes(token)) throw Object.assign(new Error('bad'), { code: 'auth/argument-error' })
    return { uid: token, email: `${token}@example.test`, email_verified: true, auth_time: nowSeconds, exp: nowSeconds + 3600 }
  } } as unknown as Auth)
  registerErrorHandler(app)
  app.decorate('enforceRateLimit', () => async () => {})
  app.decorate('createRateLimit', (() => async () => ({ isAllowed: true, key: 'shared' })) as never)
  registerOrganisationRoutes(app, organisations)
  registerProjectRoutes(app, projects)
  registerSessionRoutes(app, sessions, events, { heartbeatSeconds: 15, maxConnections: 10, maxConnectionsPerUser: 4, maxBufferedBytes: 65536, reauthenticate: async () => {} })
  registerOrganisationBillingRoutes(app, { stripe: stripe as never, billing, organisations, users, configuration: { get: async () => ({ plans, registry }) } as never,
    urls: { checkoutSuccess: new URL('https://app.test/ok'), checkoutCancel: new URL('https://app.test/cancel'), portalReturn: new URL('https://app.test/settings') },
    accounts: billingAccounts({ stripe: stripe as never, billing, users, organisations }) })
  const origin = await app.listen({ port: 0, host: '127.0.0.1' })
  const clientFor = (uid: string) => new BackendClient({ origin, token: async () => uid })
  return { app, db, data, origin, clientFor, invitations, sessions, events, billing, stripeCalls, failNextStripeUpdate: () => { updateFailsOnce = true } }
}

/** `useBackendSession`'s per-event reducer steps, in its order (as test/agent-feed-pipeline.test.tsx mirrors them). */
type FeedState = { status: string; liveLabel: string | null; streamText: string; events: ComputerTimelineEvent[] }
function apply(state: FeedState, event: SessionEvent): FeedState {
  let { status, liveLabel, streamText, events } = state
  const confirmed = sessionEventStatus[event.type]
  if (confirmed) status = confirmed
  liveLabel = executionLabel(liveLabel, event.type)
  if (event.type === 'session.running') streamText = ''
  if (event.type === 'agent.tool_call' && streamText.length > 0) streamText = closeSpokenParagraph(streamText)
  if (event.type === 'agent.text') streamText += String(event.data.delta)
  if (event.type === 'agent.tool_result') events = updateToolStepEvent(updateCommandEvent(events, event), event)
  const index = Number(event.id!.split('-')[0])
  events = reduceThinking(events, event, index)
  const item = activity(event, index)
  if (item) events = [...events, item].slice(-300)
  if (confirmed !== undefined && isTerminalStatus(confirmed)) events = interruptRunningToolEvents(events)
  return { status, liveLabel, streamText, events }
}
const key = (n: number) => `cross-app-operation-key-${String(n).padStart(4, '0')}`

test('composed trees, one user flow: organisation created and joined, a member builds in the shared workspace, run 1 loses evidence and run 2 is clean, the feed warns for run 1 only, revocation closes the door, an uncertain seat change is reconciled under its stored key', { skip: serverDir === undefined ? 'LOTUSBUILD_SERVER_DIR is not set: the composed server checkout is needed' : false }, async (t) => {
  const h = await composedServer()
  t.after(() => h.app.close())
  const A = h.clientFor(alice), B = h.clientFor(bob)

  // Organisation and membership through the real routes and client schemas.
  const org = await A.createOrganisation('Acme', key(1))
  assert.equal(org.name, 'Acme')
  await A.inviteMember(org.id, 'bob@example.test', 'member')
  assert.equal(h.invitations.length, 1, 'one invitation email left the server')
  const joined = await B.acceptInvitation(org.id, h.invitations[0]!)
  assert.equal(joined.id, org.id)
  const members = await A.organisationMembers(org.id)
  assert.deepEqual(members.members.map((m) => [m.uid, m.role]).sort(), [[alice, 'owner'], [bob, 'member']])

  // Workspace selection: the project lives in the organisation; the member sees it, nobody sees it personally.
  const project = await A.createProject({ name: 'Shared build', workspaceId: org.id }, key(2))
  assert.equal(project.workspaceId, org.id)
  assert.deepEqual((await B.projects(undefined, org.id)).projects.map((p) => p.id), [project.id], 'the member lists the shared project')
  assert.deepEqual((await B.projects(undefined, bob)).projects, [], 'nothing in the member\'s personal workspace')

  // The member starts a build; the session belongs to the organisation and the member can read it.
  const created = await B.createSession(project.id, { prompt: 'Build the landing page', model: 'model-1' }, key(3))
  const sessionId = created.id
  assert.equal(created.status, 'QUEUED')
  assert.equal((await B.session(sessionId)).projectId, project.id, 'the member reads the session of the shared project')

  // Run 1 on the real journal under a real lease: one tool result is lost (marker written), the turn ends, the run is finished.
  const lease1 = await h.sessions.claim('runner')
  assert.ok(lease1 && lease1.id === sessionId, 'the runner claims the queued session')
  const auth1 = { sessionId, runnerId: 'runner', token: lease1!.leaseToken }
  for (const [type, data] of [['session.running', { execution: 1 }], ['agent.step', { execution: 1, number: 1 }], ['agent.tool_call', { execution: 1, name: 'run_command', callId: 'c1', input: { command: 'npm test' } }]] as const) {
    await h.events.append(sessionId, type, data, auth1)
  }
  await h.sessions.markFeedIncomplete(auth1, { execution: 1, type: 'agent.tool_result', count: 1 })
  await h.events.append(sessionId, 'agent.finished', { execution: 1, incomplete: true }, auth1)
  await h.sessions.finish(sessionId, auth1, { status: 'IDLE' })
  await h.events.append(sessionId, 'session.idle', { execution: 1, incomplete: true, steps: 1, stopReason: 'end_turn' }, auth1)

  // The member resumes with a second message; run 2 is clean.
  const queued = await B.sendMessage(sessionId, { prompt: 'Now add a footer' }, key(4))
  assert.ok(queued, 'the follow-up was accepted')
  const lease2 = await h.sessions.claim('runner')
  assert.ok(lease2 && lease2.id === sessionId && lease2.execution === 2, `run 2 claimed: ${JSON.stringify(lease2 && { id: lease2.id, execution: lease2.execution })}`)
  const auth2 = { sessionId, runnerId: 'runner', token: lease2!.leaseToken }
  for (const [type, data] of [['session.running', { execution: 2 }], ['agent.step', { execution: 2, number: 1 }], ['agent.text', { execution: 2, delta: 'Added the footer.' }], ['agent.finished', { execution: 2 }]] as const) {
    await h.events.append(sessionId, type, data, auth2)
  }
  await h.sessions.finish(sessionId, auth2, { status: 'IDLE' })
  await h.events.append(sessionId, 'session.idle', { execution: 2, steps: 1, stopReason: 'end_turn' }, auth2)

  // The frontend's view: snapshot + replayed stream through the real reducer; the warning names run 1 only.
  const snapshot = await loadSessionSnapshot(B, sessionId, new AbortController().signal)
  assert.equal(snapshot.session.status, 'IDLE'); assert.equal(snapshot.session.execution, 2)
  assert.deepEqual(snapshot.session.feedIncomplete?.map((r) => [r.execution, r.lastType]), [[1, 'agent.tool_result']], 'the durable per-run record reached the client schema')
  assert.equal(snapshot.session.runEnds?.['1']?.incomplete, true); assert.equal(snapshot.session.runEnds?.['2']?.incomplete, false)
  assert.equal(snapshot.messages.length, 2, 'both prompts are in the history')
  const controller = new AbortController()
  let state: FeedState = { status: 'RUNNING', liveLabel: null, streamText: '', events: [] }
  const declared: number[] = []
  await B.events(sessionId, { signal: controller.signal, onEvent: (event) => {
    state = apply(state, event)
    if (['session.idle', 'session.queued', 'session.stopped', 'session.failed', 'agent.finished'].includes(event.type) && event.data.incomplete === true) declared.push(Number(event.data.execution))
    if (event.type === 'session.idle' && event.data.execution === 2) controller.abort()
  } }).catch((error: unknown) => { if (!controller.signal.aborted) throw error })
  assert.equal(state.status, 'IDLE')
  const rows = state.events.map((e) => `${e.title}@${e.execution}`)
  assert.ok(state.events.some((e) => e.execution === 1), `run 1's command row is on the timeline: ${rows.join(', ')}`)
  const warned = incompleteRunsShown(snapshot.session.feedIncomplete, state.events, snapshot.session.execution, declared, snapshot.session.runEnds)
  assert.deepEqual(warned.map((r) => r.execution), [1], 'run 1 is warned; the clean run 2 is not blamed')
  assert.equal(runEndUnrecorded(snapshot.session.status, snapshot.session.execution, snapshot.session.runStart, snapshot.session.runEnds), false, 'run 2\'s end is on record')

  // Revocation: the removed member gets 404s; the owner still reads the session.
  await A.removeMember(org.id, bob)
  await assert.rejects(B.session(sessionId), (error: unknown) => error instanceof BackendError && error.status === 404)
  await assert.rejects(B.sendMessage(sessionId, { prompt: 'still here?' }, key(5)), (error: unknown) => error instanceof BackendError && error.status === 404)
  assert.equal((await A.session(sessionId)).id, sessionId)

  // Billing: the owner asks for 3 seats; Stripe's answer is lost; the client sees a failure, not a success; reconcile replays under the stored key and settles.
  await h.billing.linkCustomer({ id: org.id, kind: 'organisation' }, 'cus_org')
  h.data.set(`organizations/${org.id}`, { ...h.data.get(`organizations/${org.id}`)!, seats: 2 })
  h.failNextStripeUpdate()
  await assert.rejects(A.changeSeats(org.id, 3, key(6)), (error: unknown) => error instanceof BackendError && error.status >= 500)
  const recovered = await A.reconcileSeats(org.id)
  assert.equal(recovered.pending, null, `the pending operation settled: ${JSON.stringify(recovered.pending)}`)
  assert.equal(recovered.subscription?.seats, 3)
  const keys = new Set(h.stripeCalls.map((c) => (c.args[2] as { idempotencyKey?: string } | undefined)?.idempotencyKey))
  assert.equal(h.stripeCalls.length, 2); assert.equal(keys.size, 1, 'the replay asked Stripe under the original operation key')
})
