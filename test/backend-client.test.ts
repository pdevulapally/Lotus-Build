import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient, BackendError, backendOrigin, readEvents, type SessionEvent } from '../lib/backend/client'
import { createBuild, pendingBuild, type ProjectCreationRequest } from '../lib/backend/create-build'
import { sendMessage } from '../lib/backend/send-message'
import { authErrorMessage } from '../lib/auth/errors'
import { resolveModelSelection } from '../lib/backend/model-selection'
import { presentRequestError } from '../lib/backend/error-presentation'
import { MissingProjectSessionError, projectSessionPath } from '../lib/backend/project-session-path'
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from '../lib/backend/checkout-attempt'

test('checkout cancellation resumes the original Stripe URL for the same account', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const url = 'https://checkout.stripe.com/c/pay/cs_test_only_example#return-fragment'
  saveCheckoutAttempt(storage, { uid: 'user-a', planKey: 'pro', url })
  assert.deepEqual(readCheckoutAttempt(storage, 'user-a'), { uid: 'user-a', planKey: 'pro', url })
  assert.equal(readCheckoutAttempt(storage, 'user-b'), null)
  assert.equal(values.size, 1)
  values.set('lotus-checkout-attempt:user-a', JSON.stringify({ uid: 'user-a', planKey: 'pro', url: 'https://fake-stripe.example/pay' }))
  assert.equal(readCheckoutAttempt(storage, 'user-a'), null)
  assert.throws(() => saveCheckoutAttempt(storage, { uid: 'user-a', planKey: 'pro', url: 'http://checkout.stripe.com/pay' }))
  saveCheckoutAttempt(storage, { uid: 'user-a', planKey: 'pro', url })
  clearCheckoutAttempt(storage, 'user-a')
  assert.equal(readCheckoutAttempt(storage, 'user-a'), null)
})

test('quota error UI validates server details and keeps used and reserved usage distinct', async () => {
  const details = { label: 'Builds', unit: 'count', limit: 10, consumed: 7, reserved: 3 }
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test-token',
    fetch: async () => new Response(JSON.stringify({ error: { code: 'usage/limit-reached', message: 'Technical quota message', details } }), { status: 403 }) })
  await assert.rejects(client.projects(), (error: unknown) => {
    assert.ok(error instanceof BackendError)
    const presentation = presentRequestError(error, 'Free')
    assert.equal(presentation.title, 'Limit reached')
    assert.match(presentation.description, /Your Free plan’s builds for this cycle are used up/)
    assert.deepEqual(presentation.quota, details)
    return true
  })
  for (const invalid of [undefined, { ...details, consumed: -1 }, { ...details, limit: '10' }]) {
    const presentation = presentRequestError(new BackendError(403, 'usage/limit-reached', 'Raw quota text', undefined, invalid))
    assert.equal(presentation.quota, null)
    assert.ok(!presentation.description.includes('10'))
  }
  assert.equal(presentRequestError(new Error('Network unavailable')).description, 'Network unavailable')
  assert.equal(presentRequestError(new BackendError(400, 'other/error', 'Not a quota', undefined, details)).isQuota, false)
})

test('project limit errors offer a clear next step without inventing a limit', () => {
  const error = new BackendError(403, 'project/limit-reached', 'The Free plan allows 3 projects.', undefined, { limit: 3, current: 3, plan: 'free' })
  const presentation = presentRequestError(error, 'Free')
  assert.equal(presentation.isProjectLimit, true)
  assert.equal(presentation.isQuota, false)
  assert.equal(presentation.title, 'Project limit reached')
  assert.match(presentation.description, /Free plan includes 3 projects/)
  assert.match(presentation.description, /Your idea is still here/)
  assert.ok(!presentation.description.includes('Discard'))

  const invalid = presentRequestError(new BackendError(403, 'project/limit-reached', 'Technical limit', undefined, { limit: '3' }))
  assert.ok(!invalid.description.includes('3'))
  assert.ok(!invalid.description.includes('Technical limit'))
  assert.equal(presentRequestError(new BackendError(403, 'project/platform-not-permitted', 'Different restriction')).isProjectLimit, false)
})

test('model defaults follow the account catalog without replacing explicit or pending choices', () => {
  assert.equal(resolveModelSelection([], ''), '')
  assert.equal(resolveModelSelection(['allowed-a', 'allowed-b'], ''), 'allowed-a')
  assert.equal(resolveModelSelection(['allowed-a', 'allowed-b'], 'allowed-b'), 'allowed-b')
  assert.equal(resolveModelSelection(['allowed-a'], 'pending-unavailable'), '')
  assert.equal(resolveModelSelection([], 'allowed-b'), '')
  assert.equal(resolveModelSelection(['allowed-b', 'allowed-a'], 'allowed-a'), 'allowed-a')
})

const createdAt = '2026-10-17T12:00:00.000Z'
const project = { id: 'p1', name: 'App', platform: 'web', status: 'draft', publicPreviewEnabled: false, createdAt }
const session = { id: 's1', projectId: 'p1', status: 'QUEUED', model: 'configured-model', effort: 'standard', mode: 'build', messageCount: 1, createdAt }
const key = 'client-operation-123'

test('project navigation resolves the computer session for both sidebar actions', async () => {
  let lookups = 0
  const client = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async () => { lookups++; return Response.json({ sessions: [session] }) },
  })
  assert.equal(await projectSessionPath(client, { id: 'p1' }), '/computer/s1')
  assert.equal(lookups, 1)
  assert.equal(await projectSessionPath(client, { id: 's2', kind: 'computer' }), '/computer/s2')
  assert.equal(lookups, 1)

  const withoutSession = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async () => Response.json({ sessions: [] }),
  })
  await assert.rejects(projectSessionPath(withoutSession, { id: 'p2' }), MissingProjectSessionError)
})

test('desktop tickets use an authenticated POST and validate the session-specific socket path', async () => {
  const requests: { url: string; method?: string; body?: string }[] = []
  const client = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init?.method, body: init?.body as string | undefined })
      return Response.json({ ticket: 'one-use-ticket', expiresInSeconds: 30, path: '/sessions/session_1/desktop' })
    },
  })
  assert.deepEqual(await client.desktopTicket('session_1'), {
    ticket: 'one-use-ticket',
    expiresInSeconds: 30,
    path: '/sessions/session_1/desktop',
  })
  assert.deepEqual(requests, [{
    url: 'https://api.example.test/sessions/session_1/desktop-ticket',
    method: 'POST',
    body: undefined,
  }])

  const invalidPath = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async () => Response.json({ ticket: 'one-use-ticket', expiresInSeconds: 30, path: '/sessions/other/desktop' }),
  })
  await assert.rejects(invalidPath.desktopTicket('session_1'), (error: unknown) => {
    assert.ok(error instanceof BackendError)
    assert.equal(error.code, 'response/invalid')
    return true
  })
})

test('auth UI distinguishes provider configuration failures without exposing raw error data', () => {
  const sensitiveMessage = 'email=private@example.test token=private-token apiKey=private-key'
  for (const code of ['auth/invalid-api-key', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/popup-blocked', 'auth/network-request-failed']) {
    const message = authErrorMessage({ code, message: sensitiveMessage })
    assert.ok(message.includes(code))
    assert.ok(!message.includes('private'))
    assert.ok(!message.includes('password is incorrect'))
  }
  for (const code of ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential']) {
    assert.equal(authErrorMessage({ code }), 'The email or password is incorrect. Check your details and try again.')
  }
  assert.equal(authErrorMessage(new Error(sensitiveMessage)), 'Could not sign in. Try again or contact support.')
  assert.equal(authErrorMessage({ code: sensitiveMessage }), 'Could not sign in. Try again or contact support.')
  assert.equal(authErrorMessage({ code: 'auth/user-not-found' }, 'reset'), 'Could not send a reset link. Try again or contact support.')
  assert.equal(authErrorMessage(null, 'sign-up'), 'Could not create your account. Try again or contact support.')
})

test('default browser fetch is called without the client as its receiver', async (context) => {
  context.mock.method(globalThis, 'fetch', async function (this: unknown) {
    assert.equal(this, undefined, 'native browser fetch must not be called as a BackendClient method')
    return Response.json({ projects: [] })
  })
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'id-token' })
  assert.deepEqual(await client.projects(), { projects: [] })
})

test('core requests use the current server paths, validated bodies and stable mutation keys', async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'id-token', fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    const url = new URL(String(input)); const path = url.pathname
    const body = path === '/projects' && init?.method === 'POST' ? project
      : path === '/projects' ? { projects: [project] }
      : path === '/projects/p1/sessions' && init?.method === 'POST' ? session
      : path === '/projects/p1/sessions' ? { sessions: [session] }
      : path === '/sessions/s1/messages' && init?.method === 'POST' ? { queued: false, session }
      : path === '/sessions/s1/messages' ? { messages: [{ seq: 0, role: 'user', content: 'Build', createdAt }] }
      : path === '/sessions/s1' || path === '/sessions/s1/cancel' ? session : project
    return Response.json(body)
  } })
  await client.projects(); await client.createProject({ name: ' App ' }, key)
  await client.createProject({ name: ' App ' }, key)
  await client.createSession('p1', { prompt: ' Build ', model: 'configured-model' }, key)
  await client.sessions('p1'); await client.session('s1'); await client.messages('s1')
  await client.sendMessage('s1', { prompt: ' Continue ' }, key); await client.cancel('s1', key); await client.cancel('s1', key, 4)
  assert.equal(calls[0]!.url, 'https://api.example.test/projects?limit=100')
  for (const call of calls) {
    assert.equal(new Headers(call.init?.headers).get('authorization'), 'Bearer id-token')
    assert.equal(call.init?.credentials, 'omit'); assert.equal(call.init?.redirect, 'error')
    assert.ok(!call.url.includes('/api/'))
  }
  assert.equal(calls[1]!.init?.body, JSON.stringify({ name: 'App' }))
  assert.deepEqual(calls[1], calls[2], 'a caller retry retains its operation key and payload')
  assert.equal(new Headers(calls[7]!.init?.headers).get('idempotency-key'), key)
  assert.equal(calls[7]!.init?.body, JSON.stringify({ prompt: 'Continue' }))
  assert.equal(calls[8]!.init?.body, undefined, 'a Stop without a known run sends no body')
  assert.equal(calls[9]!.init?.body, JSON.stringify({ execution: 4 }), 'a Stop names the run it is meant for')
  assert.throws(() => client.cancel('s1', key, 0), 'a run number is a positive integer')
})

test('malformed identifiers, prompts, keys and destinations are refused before a request', async () => {
  let sent = 0
  const client = new BackendClient({ origin: 'http://localhost:3001', token: async () => 'token', fetch: async () => { sent++; return Response.json({}) } })
  assert.throws(() => client.createSession('../p', { prompt: 'Build', model: 'model' }, key))
  assert.throws(() => client.sendMessage('s1', { prompt: 'x'.repeat(8001) }, key))
  assert.throws(() => client.sendMessage('s1', { prompt: '\u0000' }, key))
  assert.throws(() => client.createProject({ name: 'App' }, 'bad'))
  assert.equal(sent, 0)
  for (const url of ['http://remote.test', 'https://u:p@host.test', 'https://host.test/api', 'https://host.test?token=private', 'javascript:alert(1)']) {
    assert.throws(() => backendOrigin(url))
  }
})

test('Auto is accepted in session and message commands once the account advertises it', async () => {
  const calls: { path: string; method: string; body: unknown }[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input, init) => {
    calls.push({ path: new URL(String(input)).pathname, method: String(init?.method), body: JSON.parse(String(init?.body)) })
    return Response.json(new URL(String(input)).pathname.endsWith('/messages') ? { queued: false, session: { ...session, mode: 'auto' } } : { ...session, mode: 'auto' })
  } })
  await client.createSession('p1', { prompt: 'Decide what this needs', model: 'configured-model', mode: 'auto' }, key)
  await client.sendMessage('s1', { prompt: 'Continue intelligently', mode: 'auto' }, key)
  assert.deepEqual(calls, [
    { path: '/projects/p1/sessions', method: 'POST', body: { prompt: 'Decide what this needs', model: 'configured-model', mode: 'auto' } },
    { path: '/sessions/s1/messages', method: 'POST', body: { prompt: 'Continue intelligently', mode: 'auto' } },
  ])
})

test('server auth and idempotency errors retain stable codes without retrying mutations', async () => {
  let sent = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => {
    sent++; return Response.json({ error: { code: 'request/idempotency-conflict', message: 'Different request' }, requestId: 'req-1' }, { status: 409 })
  } })
  await assert.rejects(client.createProject({ name: 'App' }, key), (error: unknown) => {
    assert.ok(error instanceof BackendError); assert.equal(error.status, 409)
    assert.equal(error.code, 'request/idempotency-conflict'); assert.equal(error.requestId, 'req-1'); return true
  })
  assert.equal(sent, 1)
  const anonymous = new BackendClient({ origin: 'https://api.example.test', token: async () => '', fetch: async () => { throw new Error('Must not dispatch') } })
  await assert.rejects(anonymous.me(), { code: 'auth/missing-token' })
})

test('email verification client calls match the server routes and preserve retry details', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const client = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async (input, init) => {
      calls.push({ url: String(input), init })
      return String(input).endsWith('/code')
        ? Response.json({ verified: false, expiresInSeconds: 600, resendAfterSeconds: 60 })
        : Response.json({ verified: true })
    },
  })

  assert.deepEqual(await client.sendEmailVerificationCode(), {
    verified: false,
    expiresInSeconds: 600,
    resendAfterSeconds: 60,
  })
  assert.deepEqual(await client.verifyEmailCode('123456'), { verified: true })
  assert.deepEqual(calls.map(({ url, init }) => ({
    url,
    method: init?.method,
    body: init?.body,
    authorization: new Headers(init?.headers).get('authorization'),
  })), [
    {
      url: 'https://api.example.test/auth/email-verification/code',
      method: 'POST',
      body: undefined,
      authorization: 'Bearer id-token',
    },
    {
      url: 'https://api.example.test/auth/email-verification/verify',
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
      authorization: 'Bearer id-token',
    },
  ])
  assert.throws(() => client.verifyEmailCode('12345'))

  const rejected = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async () => Response.json({
      error: {
        code: 'email/daily-limit-reached',
        message: 'Daily limit reached',
        details: { retryAfterSeconds: 3600 },
      },
    }, { status: 503 }),
  })
  await assert.rejects(rejected.sendEmailVerificationCode(), (error: unknown) => {
    assert.ok(error instanceof BackendError)
    assert.equal(error.code, 'email/daily-limit-reached')
    assert.deepEqual(error.details, { retryAfterSeconds: 3600 })
    return true
  })
})

test('unexpected response data fails validation instead of manufacturing project state', async () => {
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => Response.json({ id: 'p1' }) })
  await assert.rejects(client.project('p1'), { code: 'response/invalid' })
})

function bytes(text: string) {
  const encoded = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({ start(controller) {
    // Every possible UTF-8 and line boundary is split.
    for (const value of encoded) controller.enqueue(new Uint8Array([value]))
    controller.close()
  } })
}

test('SSE handles split UTF-8, CRLF, multiline data and id-less closing controls', async () => {
  const events: SessionEvent[] = []
  await readEvents(bytes(': heartbeat\r\nid: 42-1\r\nevent: agent.text\r\ndata: {"delta":\r\ndata: "你好"}\r\n\r\nevent: stream.closing\ndata: {"reason":"token-expired"}\n\n'), (event) => { events.push(event) })
  assert.deepEqual(events, [
    { id: '42-1', type: 'agent.text', data: { delta: '你好' } },
    { type: 'stream.closing', data: { reason: 'token-expired' } },
  ])
})

test('SSE resumes with an authorization header and the last accepted Redis ID', async () => {
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'fresh-token', fetch: async (input, init) => {
    assert.equal(String(input), 'https://api.example.test/sessions/s1/events')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fresh-token')
    assert.equal(new Headers(init?.headers).get('last-event-id'), '42-1')
    return new Response(bytes('id: 43-0\nevent: project.saved\ndata: {"committed":true}\n\n'), { headers: { 'content-type': 'text/event-stream' } })
  } })
  const events: SessionEvent[] = []
  await client.events('s1', { signal: new AbortController().signal, after: '42-1', onEvent: (event) => { events.push(event) } })
  assert.equal(events[0]!.id, '43-0')
})

test('truncated or oversized SSE fails without acknowledging an incomplete event', async () => {
  const events: SessionEvent[] = []
  await assert.rejects(readEvents(bytes('id: 1-0\nevent: agent.text\ndata: {"delta":"partial"}'), (event) => { events.push(event) }), { code: 'stream/truncated' })
  assert.deepEqual(events, [])
  const oversized = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data: '+ 'x'.repeat(1_048_577))); controller.close() } })
  await assert.rejects(readEvents(oversized, () => {}), { code: 'stream/too-large' })
})

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) }, values }
}

for (const uncertain of ['project', 'session'] as const) {
  for (const entrypoint of [undefined, 'voice'] as const) {
  test(`${entrypoint ?? 'text'} project creation resumes after a lost ${uncertain} response and browser reload without duplicating resources`, async () => {
    const state = storage(); const receipts = new Map<string, { body: string; value: unknown }>()
    let projects = 0; let sessions = 0; let loseResponse = true
    const fetcher: typeof fetch = async (input, init) => {
      const operationKey = new Headers(init?.headers).get('idempotency-key')!
      const kind = new URL(String(input)).pathname === '/projects' ? 'project' : 'session'
      if (kind === 'session' && entrypoint === 'voice') {
        assert.deepEqual(JSON.parse(String(init?.body)), { entrypoint: 'voice', mode: 'plan', model: 'configured-model' })
      }
      const old = receipts.get(operationKey)
      if (old) { assert.equal(old.body, init?.body); return Response.json(old.value) }
      const value = kind === 'project' ? { ...project, id: `p${++projects}` } : { ...session, id: `s${++sessions}`, ...(entrypoint === 'voice' ? { status: 'IDLE', messageCount: 0 } : {}) }
      receipts.set(operationKey, { body: String(init?.body), value })
      if (kind === uncertain && loseResponse) { loseResponse = false; throw new TypeError('Network interrupted after commit') }
      return Response.json(value)
    }
    const client = () => new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: fetcher })
    const request: ProjectCreationRequest = entrypoint === 'voice' ? { entrypoint: 'voice', mode: 'plan' } : { prompt: 'Build an app', mode: 'build' }
    const input = { ...request, uid: 'alice', model: 'configured-model' }
    await assert.rejects(createBuild(client(), state, input), /Network interrupted/)
    assert.equal(state.values.size, 1)
    assert.equal(pendingBuild(state, 'alice')?.entrypoint, entrypoint)
    const result = await createBuild(client(), state, input)
    if (entrypoint === 'voice') { assert.equal(result.status, 'IDLE'); assert.equal(result.messageCount, 0) }
    assert.equal(result.id, 's1'); assert.equal(projects, 1); assert.equal(sessions, 1); assert.equal(state.values.size, 0)
  })
  }
}

test('an uncertain build cannot silently substitute a different prompt or model', async () => {
  const state = storage(); let calls = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => { calls++; throw new TypeError('Unknown outcome') } })
  const input = { uid: 'alice', prompt: 'Build an app', model: 'configured-model', mode: 'build' as const }
  await assert.rejects(createBuild(client, state, input), /Unknown outcome/)
  await assert.rejects(createBuild(client, state, { ...input, model: 'another-model' }), /uncertain outcome/)
  await assert.rejects(createBuild(client, state, { ...input, prompt: 'A different app' }), /uncertain outcome/)
  assert.equal(calls, 1)
})

test('a pending chat message retains its identity across reload and refuses different text', async () => {
  const state = storage(); let accepted = 0; let calls = 0; let firstKey: string | null = null
  const fetcher: typeof fetch = async (_url, init) => {
    calls++; const operationKey = new Headers(init?.headers).get('idempotency-key')
    if (!firstKey) { firstKey = operationKey; accepted++; throw new TypeError('Lost acknowledgement') }
    assert.equal(operationKey, firstKey)
    return Response.json({ queued: false, session })
  }
  const client = () => new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: fetcher })
  await assert.rejects(sendMessage(client(), state, 'alice', 's1', 'Continue'), /Lost acknowledgement/)
  await assert.rejects(sendMessage(client(), state, 'alice', 's1', 'Different'), /pending message/)
  assert.equal(calls, 1)
  await sendMessage(client(), state, 'alice', 's1', 'Continue')
  assert.equal(accepted, 1); assert.equal(state.values.size, 0)
})

test('plans and usage accept an explicit unlimited quantity beside numeric ones', async () => {
  const meter = { meterKey: 'builds.started', unit: 'count', label: 'Builds', kind: 'COUNTER', resetPeriod: 'MONTHLY', consumed: 12, reserved: 0, totalUsed: 12, includedAllowance: 'unlimited', hardLimit: 'unlimited', overageEnabled: false, periodStart: createdAt }
  const plan = { key: 'free', name: 'Free', rank: 0, capabilities: [], allowances: [
    { key: 'builds.started', label: 'Builds', unit: 'count', included: 'unlimited', limit: 'unlimited' },
    { key: 'ai.tokens.input', label: 'AI input', unit: 'tokens', included: 300000, limit: 300000 },
  ] }
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input) => {
    const path = new URL(String(input)).pathname
    return Response.json(path === '/plans' ? { plans: [plan] } : { uid: 'alice', plan: { key: 'free', name: 'Free' }, meters: [meter] })
  } })
  assert.equal((await client.plans()).plans[0]!.allowances[0]!.limit, 'unlimited')
  assert.equal((await client.usage()).meters[0]!.hardLimit, 'unlimited')
  const rejecting = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () =>
    Response.json({ uid: 'alice', plan: { key: 'free', name: 'Free' }, meters: [{ ...meter, hardLimit: 'lots' }] }) })
  await assert.rejects(rejecting.usage())
})

test('current account, usage and queued-message response shapes are validated', async () => {
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input) => {
    const path = new URL(String(input)).pathname
    return Response.json(path === '/me' ? { uid: 'alice', email: 'alice@example.test', emailVerified: true, projectCount: 1,
      plan: { key: 'actual-plan', name: 'Actual Plan' }, models: [{ id: 'configured-model', name: 'Configured model', efforts: ['standard'], maxOutputTokens: 4096 }], capabilities: [{ key: 'ai.model.allowlist', kind: 'stringList', value: ['configured-model'] }], limits: [] }
      : path === '/me/usage' ? { uid: 'alice', plan: { key: 'actual-plan', name: 'Actual Plan' }, meters: [] }
      : { queuedMessages: [{ id: 'q1', sessionId: 's1', prompt: 'Next', createdAt }], nextCursor: null })
  } })
  assert.equal((await client.me()).plan.key, 'actual-plan')
  assert.deepEqual((await client.usage()).meters, [])
  assert.equal((await client.queuedMessages('s1')).queuedMessages[0]!.id, 'q1')
})


test('saved content uses current authenticated file, history and archive routes', async () => {
  const seen: string[] = []
  const commit = 'a'.repeat(40)
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input, init) => {
    const url = new URL(String(input)); seen.push(url.pathname)
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token')
    if (url.pathname.endsWith('/archive')) return new Response(new Uint8Array([80, 75, 3, 4]), { headers: { 'content-type': 'application/zip' } })
    if (url.pathname.endsWith('/files/content')) { assert.equal(url.searchParams.get('path'), 'src/a #.tsx'); return Response.json({ path: 'src/a #.tsx', size: 3, binary: false, content: 'abc', truncated: false }) }
    if (url.pathname.endsWith('/files')) return Response.json({ head: 'main', ref: 'main', branches: ['main'], files: [{ path: 'src/a #.tsx', size: 3 }], truncated: false })
    if (url.pathname.endsWith('/changes')) return Response.json({ commits: [{ sha: commit, parent: null, committedAt: createdAt, sessionId: 's1', message: 'Saved change' }] })
    return Response.json({ sha: commit, files: [], patch: '', truncated: false })
  } })
  assert.equal((await client.files('p1')).files.length, 1)
  assert.equal((await client.file('p1', 'src/a #.tsx')).content, 'abc')
  assert.equal((await client.history('p1')).commits[0]?.sha, commit)
  assert.equal((await client.changes('p1', commit)).sha, commit)
  assert.equal((await client.archive('p1')).type, 'application/zip')
  assert.ok(seen.every((path) => path.startsWith('/projects/p1/')))
  assert.throws(() => client.changes('p1', '../main'))
})

test('model catalog and content responses fail explicitly when missing or malformed', async () => {
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => Response.json({}) })
  await assert.rejects(client.me(), { code: 'response/invalid' })
  await assert.rejects(client.files('p1'), { code: 'response/invalid' })
  await assert.rejects(client.history('p1'), { code: 'response/invalid' })
  await assert.rejects(client.archive('p1'), { code: 'response/invalid' })
})

test('an uncertain approval keeps its identity and cannot change session mode on retry', async () => {
  const state = storage()
  const seen: Array<{ mode: string; key: string }> = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (_input, init) => {
    const body = JSON.parse(String(init?.body)); seen.push({ mode: body.mode, key: new Headers(init?.headers).get('Idempotency-Key')! })
    throw new TypeError('Connection lost')
  } })
  await assert.rejects(sendMessage(client, state, 'alice', 's1', 'Approve plan', 'build'))
  await assert.rejects(sendMessage(client, state, 'alice', 's1', 'Approve plan', 'plan'), /changing mode/)
  await assert.rejects(sendMessage(client, state, 'alice', 's1', 'Approve plan', 'build'))
  assert.equal(seen.length, 2); assert.equal(seen[0]?.mode, 'build'); assert.equal(seen[0]?.key, seen[1]?.key)
})


test('sign-in drafts preserve the supported mode without selecting a model or starting a build', async () => {
  const { saveSessionDraft, readSessionDraft } = await import('../lib/backend/draft')
  const state = storage()
  saveSessionDraft(state, { prompt: 'Build a portal', mode: 'plan' })
  assert.deepEqual(readSessionDraft(state), { prompt: 'Build a portal', mode: 'plan' })
  saveSessionDraft(state, { prompt: 'Decide for me', mode: 'auto' })
  assert.deepEqual(readSessionDraft(state), { prompt: 'Decide for me', mode: 'auto' })
  saveSessionDraft(state, { prompt: 'Choose after sign-in' })
  assert.deepEqual(readSessionDraft(state), { prompt: 'Choose after sign-in' })
})

test('session usage stays scoped to the current session and rejects malformed meter data', async () => {
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (input) => {
    assert.equal(new URL(String(input)).pathname, '/sessions/s1/usage')
    return Response.json({ sessionId: 's1', meters: [{ meterKey: 'builds', unit: 'builds', label: 'Builds', settled: 1, open: 0 }] })
  } })
  assert.equal((await client.sessionUsage('s1')).meters[0]?.settled, 1)
  const bad = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => Response.json({ sessionId: 's1', meters: [{ settled: 'unknown' }] }) })
  await assert.rejects(bad.sessionUsage('s1'), { code: 'response/invalid' })
})

test('the session contract accepts a stopped run and its run number, and still accepts servers that send neither', async () => {
  const { sessionSchema } = await import('../lib/backend/client')
  const base = { id: 's1', projectId: 'p1', status: 'RUNNING', model: 'm', effort: 'standard', mode: 'build', messageCount: 1, createdAt: '2026-11-06T10:00:00.000Z' }
  assert.equal(sessionSchema.parse(base).execution, undefined)
  const stopped = sessionSchema.parse({ ...base, status: 'STOPPED', execution: 7, cancelRequestedAt: '2026-11-06T10:00:05.000Z' })
  assert.equal(stopped.status, 'STOPPED'); assert.equal(stopped.execution, 7); assert.equal(stopped.cancelRequestedAt, '2026-11-06T10:00:05.000Z')
  assert.throws(() => sessionSchema.parse({ ...base, status: 'CANCELLED' }))
  assert.throws(() => sessionSchema.parse({ ...base, execution: 0 }))
})

test('asking for the desktop posts to the session and accepts only the run-stamped acknowledgement', async () => {
  const requests: { url: string; method?: string; body?: string }[] = []
  const client = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async (input, init) => {
      requests.push({ url: String(input), method: init?.method, body: init?.body as string | undefined })
      return Response.json({ sessionId: 'session_1', execution: 3, requested: true }, { status: 202 })
    },
  })
  assert.deepEqual(await client.requestDesktop('session_1', 3), { sessionId: 'session_1', execution: 3, requested: true })
  assert.deepEqual(requests, [{ url: 'https://api.example.test/sessions/session_1/desktop', method: 'POST', body: JSON.stringify({ execution: 3 }) }])
  assert.throws(() => client.requestDesktop('session_1', 0), 'a run number is always a positive integer')

  const refused = new BackendClient({
    origin: 'https://api.example.test',
    token: async () => 'id-token',
    fetch: async () => Response.json({ error: { code: 'desktop/no-active-run', message: 'The desktop can be started while the agent is working.' } }, { status: 409 }),
  })
  await assert.rejects(refused.requestDesktop('session_1', 3), (error: unknown) => {
    assert.ok(error instanceof BackendError)
    assert.equal(error.code, 'desktop/no-active-run')
    assert.equal(error.status, 409)
    return true
  })
})

const memoryStorage = () => { const items = new Map<string, string>(); return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => { items.set(k, v) }, removeItem: (k: string) => { items.delete(k) } } }

test('an operation key lives until its surface is confirmed: kept across network, 5xx, in-progress and refused answers and across a reload; a success settles the intents asked before it on that surface, never a newer one; another target, surface or account is another key', async () => {
  const { clearIntents, intentStore, seatsIntent, subscriptionIntent } = await import('../lib/backend/intent-key')
  const storage = memoryStorage()
  const alice = intentStore({ uid: 'alice', storage })
  const business = subscriptionIntent('plan:business'); const pro = subscriptionIntent('plan:pro')
  const first = alice.key(business)
  assert.equal(alice.key(business), first, 'the same intended action keeps its key across retries')
  assert.notEqual(alice.key(pro), first, 'another plan is another intent')
  assert.notEqual(alice.key(seatsIntent('org1', 5)), alice.key(seatsIntent('org1', 6)), 'another seat count is another intent')
  assert.notEqual(alice.key(seatsIntent('org1', 5)), alice.key(seatsIntent('org2', 5)), 'another organisation is another surface')
  assert.notEqual(alice.key(subscriptionIntent('cancellation:true')), alice.key(subscriptionIntent('cancellation:false')))
  const outcomes: unknown[] = [
    new TypeError('Failed to fetch'),
    new BackendError(503, 'billing/processing', 'Still processing'),
    new BackendError(500, 'internal', 'Synchronisation failed after the provider accepted'),
    new BackendError(502, 'billing/checkout-unavailable', 'Provider unavailable'),
    new BackendError(409, 'organisation/seat-change-in-progress', 'In progress'),
    new BackendError(429, 'organisation/limit-reached', 'Slow down'),
    new BackendError(409, 'billing/too-few-seats', 'Refused'),
  ]
  for (const outcome of outcomes) {
    await assert.rejects(alice.run(business, async () => { throw outcome }))
    assert.equal(alice.key(business), first, `${String((outcome as Error).message)}: the server recorded no success, so the retry is the same operation`)
  }
  // Reload: a new store over the same account's storage continues the same operations.
  assert.equal(intentStore({ uid: 'alice', storage }).key(business), first, 'the key survives a page load')
  assert.equal(intentStore({ uid: 'alice', storage }).key(seatsIntent('org1', 5)), alice.key(seatsIntent('org1', 5)))
  // Another account on the same browser sees none of them and cannot reuse them.
  const bob = intentStore({ uid: 'bob', storage })
  assert.notEqual(bob.key(business), first); assert.notEqual(bob.key(seatsIntent('org1', 5)), alice.key(seatsIntent('org1', 5)))
  assert.equal(alice.key(business), first, 'another account minting keys changes nothing for this one')
  assert.throws(() => intentStore({ uid: '', storage }), 'no account, no intents')
  storage.setItem('lotus-intents:carol', JSON.stringify({ uid: 'alice', next: 1, surfaces: { 'billing/subscription': { 'plan:business': { key: first, generation: 0 } } } }))
  assert.notEqual(intentStore({ uid: 'carol', storage }).key(business), first, 'a record naming another account is not trusted')
  storage.setItem('lotus-intents:dave', '{not json')
  assert.ok(intentStore({ uid: 'dave', storage }).key(business), 'a malformed record is ignored')
  // A unknown → B confirmed → a fresh A: the lost Business attempt is superseded, never replayed — also after a reload.
  await alice.run(pro, async () => undefined)
  assert.notEqual(alice.key(business), first, 'confirming Pro settles the unresolved Business attempt asked before it; choosing Business again is a new operation')
  assert.notEqual(intentStore({ uid: 'alice', storage }).key(business), first, 'and nothing in storage resurrects it')
  // A then B in flight: A's success settles only what was asked up to A. B keeps its key, retries under it,
  // and a late duplicate of A's success cannot erase it either.
  const a = alice.key(subscriptionIntent('plan:a')); const b = alice.key(subscriptionIntent('plan:b'))
  await alice.run(subscriptionIntent('plan:a'), async () => undefined)
  assert.equal(alice.key(subscriptionIntent('plan:b')), b, 'a newer unresolved action survives an older success')
  assert.notEqual(alice.key(subscriptionIntent('plan:a')), a, 'the settled action itself is new next time')
  alice.settle('billing/subscription', 0)
  assert.equal(alice.key(subscriptionIntent('plan:b')), b, 'a late repeat of the older completion changes nothing for it')
  await assert.rejects(alice.run(subscriptionIntent('plan:b'), async (key) => { assert.equal(key, b); throw new TypeError('Failed to fetch') }))
  assert.equal(alice.key(subscriptionIntent('plan:b')), b)
  await alice.run(subscriptionIntent('plan:b'), async (key) => { assert.equal(key, b) })
  assert.notEqual(alice.key(subscriptionIntent('plan:b')), b, 'its own success settles it')
  // Empty store, then a new operation, then a late duplicate of an old completion: the generation counter
  // never restarts, so generation 0 settles nothing minted since.
  const empty = memoryStorage(); const fresh = intentStore({ uid: 'alice', storage: empty })
  await fresh.run(subscriptionIntent('plan:old'), async () => undefined)
  assert.deepEqual(JSON.parse(empty.getItem('lotus-intents:alice')!).surfaces, {}, 'nothing unresolved remains')
  const minted = fresh.key(subscriptionIntent('plan:new'))
  fresh.settle('billing/subscription', 0)
  assert.equal(fresh.key(subscriptionIntent('plan:new')), minted, 'a late duplicate of the old completion cannot settle the newer operation')
  assert.equal(fresh.generations(), 2)
  // Two tabs over one account's storage: the second sees the first's key. Two tabs minting the same intent at
  // the same instant can still diverge (storage has no lock) and the server then sees two keys for one target;
  // the seat pin refuses the second with 409 seat-change-in-progress, but whether every owner/follower and
  // mirror interleaving is closed is a server question still under review on lotusbuild-server #97.
  const tabA = intentStore({ uid: 'alice', storage: empty }); const tabB = intentStore({ uid: 'alice', storage: empty })
  assert.equal(tabB.key(seatsIntent('org1', 7)), tabA.key(seatsIntent('org1', 7)))
  await tabA.run(seatsIntent('org1', 7), async () => undefined)
  assert.equal(tabB.key(seatsIntent('org1', 7)), tabA.key(seatsIntent('org1', 7)), 'the other tab sees the settlement and the new key alike')
  // Durable storage refusing to answer (local and session records disagree) fails closed: no third key is
  // minted over either record, and nothing is overwritten.
  const { durablePendingStorage } = await import('../lib/backend/pending-storage')
  const local = memoryStorage(); const session = memoryStorage()
  local.setItem('lotus-intents:alice', JSON.stringify({ uid: 'alice', next: 1, surfaces: { s: { a: { key: 'k'.repeat(20), generation: 0 } } } }))
  session.setItem('lotus-intents:alice', JSON.stringify({ uid: 'alice', next: 1, surfaces: { s: { a: { key: 'j'.repeat(20), generation: 0 } } } }))
  const conflicted = intentStore({ uid: 'alice', storage: durablePendingStorage(local, session) })
  assert.throws(() => conflicted.key({ surface: 's', action: 'a' }), /Two pending commands need review/)
  await assert.rejects(conflicted.run({ surface: 's', action: 'b' }, async () => assert.fail('never asked')), /Two pending commands need review/)
  assert.match(local.getItem('lotus-intents:alice')!, /kkkk/); assert.match(session.getItem('lotus-intents:alice')!, /jjjj/)
  const seats5 = alice.key(seatsIntent('org1', 5))
  await alice.run(subscriptionIntent('cancellation:true'), async () => undefined)
  assert.equal(alice.key(seatsIntent('org1', 5)), seats5, 'a subscription success does not settle an organisation\'s seat intent')
  // Double-click: two concurrent attempts of one intent share one key.
  const keys: string[] = []
  await Promise.all([alice.run(seatsIntent('org1', 5), async (key) => { keys.push(key) }), alice.run(seatsIntent('org1', 5), async (key) => { keys.push(key) })])
  assert.deepEqual(keys, [seats5, seats5])
  // Signing out leaves nothing of this account behind; the other account's record stays.
  const bobSeats = bob.key(seatsIntent('org1', 5))
  clearIntents(storage, 'alice')
  assert.equal(storage.getItem('lotus-intents:alice'), null); assert.equal(intentStore({ uid: 'bob', storage }).key(seatsIntent('org1', 5)), bobSeats)
  // Through the client: same intent → same key and byte-identical payload, including after a reload with
  // the answer lost; the key is validated before any request; a change may leave no subscription.
  const calls: { url: string; init?: RequestInit }[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'id-token', fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ subscription: calls.length === 3 ? null : { planKey: 'business', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-12-01T00:00:00.000Z' } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch })
  const key = alice.key(business)
  await client.changePlan('business', key)
  await client.changePlan('business', intentStore({ uid: 'alice', storage }).key(business))
  const gone = await client.setCancellation(true, alice.key(subscriptionIntent('cancellation:true')))
  assert.equal(gone.subscription, null, 'a change that leaves no subscription is a legitimate answer')
  assert.equal(new Headers(calls[0]!.init?.headers).get('idempotency-key'), key)
  assert.deepEqual(calls[0], calls[1], 'a retry of the same intent after a reload is the same request')
  assert.notEqual(new Headers(calls[2]!.init?.headers).get('idempotency-key'), key)
  await client.changeSeats('org1', 5, alice.key(seatsIntent('org1', 5))).catch(() => undefined) // the stub answers with a personal subscription; the request itself is what is checked here
  assert.equal(new Headers(calls[3]!.init?.headers).get('idempotency-key'), intentStore({ uid: 'alice', storage }).key(seatsIntent('org1', 5)), 'a seat change carries the key of its intended seat count, also after a reload')
  assert.equal(calls[3]!.init?.body, JSON.stringify({ seats: 5 }))
  assert.throws(() => client.changePlan('business', 'short'), 'an invalid key is a definite client error, sent nowhere')
  assert.equal(calls.length, 4)
  clearIntents(storage, 'alice')
})


test('a Settings action belongs to the account signed in when it started: after a switch, its outcome shows nothing under the new account', async () => {
  const { principalFence } = await import('../lib/settings/principal-fence')
  let uid = 'alice'
  const seen: string[] = []
  const actions = { busy: (v: boolean) => { seen.push(`busy:${v}`) }, error: (m: string | null) => { seen.push(`error:${m}`) }, message: (t: string | null) => { seen.push(`message:${t}`) } }
  const perform = principalFence(() => uid)
  let release!: () => void
  const held = perform(async (live) => { await new Promise<void>((resolve) => { release = resolve }); if (live()) actions.message('A quote confirmed') }, actions)
  assert.deepEqual(seen, ['busy:true', 'error:null', 'message:null'])
  uid = 'bob'; release(); await held
  assert.deepEqual(seen, ['busy:true', 'error:null', 'message:null'], 'nothing from A\'s action reaches B: no message, no busy reset')
  seen.length = 0
  const failing = perform(async () => { await new Promise<void>((resolve) => { release = resolve }); throw new Error('declined') }, actions)
  uid = 'carol'; release(); await failing
  assert.deepEqual(seen, ['busy:true', 'error:null', 'message:null'], 'nor does A\'s failure')
  seen.length = 0
  await perform(async (live) => { if (live()) actions.message('done') }, actions)
  assert.deepEqual(seen, ['busy:true', 'error:null', 'message:null', 'message:done', 'busy:false'], 'the same account sees its own outcome')
  seen.length = 0
  await perform(async () => { throw new Error('declined') }, actions)
  assert.deepEqual(seen, ['busy:true', 'error:null', 'message:null', 'error:declined', 'busy:false'])
})
