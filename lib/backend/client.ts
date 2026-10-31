import { z } from 'zod'
import { attachmentRefSchema, attachmentRefsSchema, isAttachmentMediaType, storedAttachmentSchema, type AttachmentRef } from './attachments'

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const timestamp = z.string().datetime({ offset: true })
const sha = z.string().regex(/^[0-9a-f]{40,64}$/)
export const fileTreeSchema = z.object({ head: z.string().nullable(), ref: z.string().nullable(), branches: z.array(z.string()),
  files: z.array(z.object({ path: z.string().min(1), size: z.number().int().nonnegative() })), truncated: z.boolean() })
export const fileSchema = z.object({ path: z.string(), size: z.number().int().nonnegative(), binary: z.boolean(), content: z.string().nullable(), truncated: z.boolean() })
export const historySchema = z.object({ commits: z.array(z.object({ sha, parent: sha.nullable(), committedAt: timestamp, sessionId: id.nullable(), message: z.string() })) })
export const changesSchema = z.object({ sha, files: z.array(z.object({ path: z.string(), previousPath: z.string().nullable(),
  additions: z.number().int().nonnegative().nullable(), deletions: z.number().int().nonnegative().nullable() })), patch: z.string(), truncated: z.boolean() })
export type BackendFileTree = z.infer<typeof fileTreeSchema>
export type BackendFile = z.infer<typeof fileSchema>
export type BackendHistory = z.infer<typeof historySchema>
export type BackendChanges = z.infer<typeof changesSchema>
export const projectSchema = z.object({
  id, name: z.string(), description: z.string().optional(), platform: z.enum(['web', 'mobile']),
  status: z.enum(['draft', 'deleting']), publicPreviewEnabled: z.boolean(), createdAt: timestamp,
})
export const sessionSchema = z.object({
  id, projectId: id, status: z.enum(['QUEUED', 'RUNNING', 'IDLE', 'FAILED']), model: z.string(),
  effort: z.enum(['low', 'standard', 'high', 'xhigh']), mode: z.enum(['build', 'plan']),
  sandboxId: z.string().optional(), error: z.string().optional(), messageCount: z.number().int().nonnegative(),
  heartbeatAt: timestamp.optional(), createdAt: timestamp,
  cancelRequested: z.boolean().optional(),
  fallback: z.object({ status: z.enum(['AWAITING_CONSENT', 'QUEUED', 'RUNNING', 'CAPACITY_WAIT', 'EXHAUSTED', 'SHARED_LIMIT', 'UNAVAILABLE', 'COMPLETED']),
    reason: z.string(), resumable: z.boolean(), checkpointId: id.optional(), lane: z.enum(['premium', 'fallback']).optional(), consent: z.boolean(),
    imageExpiresAt: timestamp.optional(), resetAt: timestamp.optional(), retryAt: timestamp.optional(), limitLabel: z.string().optional(),
    offer: z.object({ model: z.string(), effort: z.enum(['low', 'standard', 'high', 'xhigh']) }).optional(),
  }).optional(),
  pendingInput: z.object({ id, kind: z.enum(['question', 'approval']), prompt: z.string() }).optional(),
})
export const messageSchema = z.object({
  seq: z.number().int().nonnegative(), role: z.enum(['user', 'assistant']), content: z.string(), createdAt: timestamp,
  attachments: z.array(attachmentRefSchema).default([]),
})
const capabilitySchema = z.discriminatedUnion('kind', [
  z.object({ key: z.string(), kind: z.literal('boolean'), value: z.boolean() }),
  z.object({ key: z.string(), kind: z.literal('number'), value: z.number() }),
  z.object({ key: z.string(), kind: z.literal('string'), value: z.string() }),
  z.object({ key: z.string(), kind: z.literal('stringList'), value: z.array(z.string()) }),
])
export const accountSchema = z.object({
  uid: z.string().min(1), email: z.string(), emailVerified: z.boolean(), displayName: z.string().optional(),
  photoUrl: z.string().optional(), projectCount: z.number().int().nonnegative(),
  plan: z.object({ key: z.string(), name: z.string() }), subscriptionStatus: z.string().optional(),
  capabilities: z.array(capabilitySchema), limits: z.array(z.object({
    meterKey: z.string(), includedAllowance: z.number(), hardLimit: z.number(), overageEnabled: z.boolean(),
  })),
  models: z.array(z.object({ id: z.string(), name: z.string().min(1), efforts: z.array(z.enum(['low', 'standard', 'high', 'xhigh'])), maxOutputTokens: z.number().int().positive() })),
})
export const usageSchema = z.object({ uid: z.string(), plan: z.object({ key: z.string(), name: z.string() }),
  meters: z.array(z.object({ meterKey: z.string(), unit: z.string(), label: z.string(),
    kind: z.enum(['COUNTER', 'GAUGE']), resetPeriod: z.enum(['NEVER', 'DAILY', 'MONTHLY']),
    consumed: z.number().nonnegative(), reserved: z.number().nonnegative(), totalUsed: z.number().nonnegative(),
    includedAllowance: z.number(), hardLimit: z.number(), overageEnabled: z.boolean(), periodStart: timestamp,
  })),
})
const queuedSchema = z.object({ id, sessionId: id, prompt: z.string(), attachments: z.array(attachmentRefSchema).default([]), createdAt: timestamp })
const acceptedMessageSchema = z.union([
  z.object({ steered: z.literal(true), sessionId: id }),
  z.object({ queued: z.literal(true), queuedMessage: queuedSchema }),
  z.object({ queued: z.literal(false), session: sessionSchema }),
])
const emailVerificationCodeSentSchema = z.object({
  verified: z.boolean(),
  expiresInSeconds: z.number().int().nonnegative(),
  resendAfterSeconds: z.number().int().nonnegative(),
})
const emailVerificationResultSchema = z.object({ verified: z.boolean() })
const desktopTicketSchema = z.object({
  ticket: z.string().min(1).max(2048),
  expiresInSeconds: z.number().positive(),
  path: z.string(),
})
export type BackendProject = z.infer<typeof projectSchema>
export type BackendSession = z.infer<typeof sessionSchema>
export type BackendAccount = z.infer<typeof accountSchema>
export type BackendUsage = z.infer<typeof usageSchema>
export type BackendMessage = z.infer<typeof messageSchema>
export type SessionEvent = { id?: string; type: string; data: Record<string, unknown> }
const planSchema = z.object({ key: z.string(), name: z.string(), rank: z.number(),
  price: z.object({ amountMinor: z.number().int().positive(), currency: z.string().regex(/^[a-z]{3}$/), interval: z.enum(['day', 'week', 'month', 'year']) }).optional(),
  capabilities: z.array(capabilitySchema.and(z.object({ label: z.string() }))),
  allowances: z.array(z.object({ key: z.string(), label: z.string(), unit: z.string(), included: z.number(), limit: z.number() })),
})
export type BackendPlan = z.infer<typeof planSchema>

export class BackendError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown
  constructor(status: number, code: string, message: string, requestId?: string, details?: unknown) {
    super(message); this.name = 'BackendError'; this.status = status; this.code = code
    this.requestId = requestId
    this.details = details
  }
}

/** Explicit configuration; never silently send account tokens to a guessed server. */
export function backendOrigin(value: string): string {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error('Backend URL must be an HTTPS origin (HTTP is allowed only on loopback).')
  return url.origin
}

const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const streamId = z.string().regex(/^\d{1,20}-\d{1,20}$/)
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }), requestId: z.string().optional() })

/** Uncertain mutations are never retried; only a rejected expired token is refreshed once. */
export class BackendClient {
  private readonly origin: string
  private readonly token: (forceRefresh?: boolean) => Promise<string>
  private readonly fetcher: typeof fetch
  constructor(options: { origin: string; token: (forceRefresh?: boolean) => Promise<string>; fetch?: typeof fetch }) {
    this.origin = backendOrigin(options.origin); this.token = options.token
    const fetcher = options.fetch ?? fetch
    // Native browser fetch must not receive this BackendClient as its receiver.
    this.fetcher = (...args) => fetcher(...args)
  }

  private async response(path: string, options: { method?: string; body?: unknown; raw?: { body: Blob; contentType: string }; key?: string; signal?: AbortSignal; after?: string; public?: true } = {}, forceRefresh = false): Promise<Response> {
    const token = options.public ? undefined : await this.token(forceRefresh)
    options.signal?.throwIfAborted()
    if (!options.public && !token) throw new BackendError(401, 'auth/missing-token', 'Sign in to continue.')
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    if (options.body !== undefined && options.raw !== undefined) throw new Error('A request carries either JSON or a raw body, not both.')
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.raw !== undefined) headers['Content-Type'] = options.raw.contentType
    if (options.key !== undefined) headers['Idempotency-Key'] = keySchema.parse(options.key)
    if (options.after !== undefined) headers['Last-Event-ID'] = streamId.parse(options.after)
    const response = await this.fetcher(`${this.origin}${path}`, {
      method: options.method ?? 'GET', headers, cache: 'no-store', credentials: 'omit', redirect: 'error',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.raw === undefined ? {} : { body: options.raw.body }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const error = errorSchema.safeParse(body)
      if (!options.public && !forceRefresh && response.status === 401 && error.success && error.data.error.code === 'auth/token-expired') {
        return this.response(path, options, true)
      }
      throw error.success
        ? new BackendError(response.status, error.data.error.code, error.data.error.message, error.data.requestId, error.data.error.details)
        : new BackendError(response.status, 'response/invalid-error', 'The server returned an invalid error response.')
    }
    return response
  }

  private async json<T>(schema: z.ZodType<T>, path: string, options?: Parameters<BackendClient['response']>[1]): Promise<T> {
    const response = await this.response(path, options)
    let body: unknown
    try { body = await response.json() }
    catch { throw new BackendError(502, 'response/invalid-json', 'The server returned invalid JSON.') }
    const result = schema.safeParse(body)
    if (!result.success) throw new BackendError(502, 'response/invalid', 'The server returned an unexpected response.')
    return result.data
  }

  me(signal?: AbortSignal) { return this.json(accountSchema, '/me', { signal }) }
  sendEmailVerificationCode() {
    return this.json(emailVerificationCodeSentSchema, '/auth/email-verification/code', { method: 'POST' })
  }
  verifyEmailCode(code: string) {
    const body = z.object({ code: z.string().regex(/^[0-9]{6}$/) }).strict().parse({ code })
    return this.json(emailVerificationResultSchema, '/auth/email-verification/verify', { method: 'POST', body })
  }
  usage(signal?: AbortSignal) { return this.json(usageSchema, '/me/usage', { signal }) }
  sessionUsage(sessionId: string, signal?: AbortSignal) { return this.json(z.object({ sessionId: id,
    meters: z.array(z.object({ meterKey: z.string(), unit: z.string(), label: z.string(), settled: z.number().nonnegative(), open: z.number().nonnegative() })) }), `/sessions/${id.parse(sessionId)}/usage`, { signal }) }
  plans(signal?: AbortSignal) { return this.json(z.object({ plans: z.array(planSchema) }), '/plans', { signal, public: true }) }
  billingPortal() { return this.json(z.object({ url: z.url().startsWith('https://') }), '/billing/portal', { method: 'POST' }) }
  checkout(planKey: string) { return this.json(z.object({ url: z.url().startsWith('https://') }), '/billing/checkout', {
    method: 'POST', body: { planKey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).parse(planKey) },
  }) }
  requestErasure() { return this.json(z.object({ request: z.object({ reference: z.string(), kind: z.literal('erasure'), status: z.enum(['RECEIVED', 'IN_PROGRESS', 'COMPLETED']), receivedAt: timestamp }), message: z.string() }),
    '/me/privacy-requests', { method: 'POST', body: { kind: 'erasure' } }) }
  projects(signal?: AbortSignal) { return this.json(z.object({ projects: z.array(projectSchema) }), '/projects?limit=100', { signal }) }
  project(projectId: string, signal?: AbortSignal) { return this.json(projectSchema, `/projects/${id.parse(projectId)}`, { signal }) }
  files(projectId: string, signal?: AbortSignal) { return this.json(fileTreeSchema, `/projects/${id.parse(projectId)}/files`, { signal }) }
  file(projectId: string, path: string, signal?: AbortSignal) {
    return this.json(fileSchema, `/projects/${id.parse(projectId)}/files/content?${new URLSearchParams({ path: z.string().min(1).max(1024).parse(path) })}`, { signal })
  }
  history(projectId: string, signal?: AbortSignal) { return this.json(historySchema, `/projects/${id.parse(projectId)}/changes`, { signal }) }
  changes(projectId: string, commit: string, signal?: AbortSignal) { return this.json(changesSchema, `/projects/${id.parse(projectId)}/changes/${sha.parse(commit)}`, { signal }) }
  async archive(projectId: string) {
    const response = await this.response(`/projects/${id.parse(projectId)}/archive`)
    if (!response.headers.get('content-type')?.startsWith('application/zip')) throw new BackendError(502, 'response/invalid', 'The server did not return a project archive.')
    return response.blob()
  }
  renameProject(projectId: string, name: string) {
    const body = z.object({ name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/) }).parse({ name })
    return this.json(projectSchema, `/projects/${id.parse(projectId)}`, { method: 'PATCH', body })
  }
  createProject(input: { name: string; description?: string }, key: string) {
    const body = z.object({ name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/),
      description: z.string().trim().max(500).regex(/^[^\u0000-\u001f\u007f]+$/).optional() }).strict().parse(input)
    return this.json(projectSchema, '/projects', { method: 'POST', body, key: keySchema.parse(key) })
  }
  async deleteProject(projectId: string) { await this.response(`/projects/${id.parse(projectId)}`, { method: 'DELETE' }) }
  sessions(projectId: string, signal?: AbortSignal) { return this.json(z.object({ sessions: z.array(sessionSchema) }), `/projects/${id.parse(projectId)}/sessions?limit=100`, { signal }) }
  createSession(projectId: string, input: { prompt: string; model: string; mode?: 'build' | 'plan'; effort?: 'low' | 'standard' | 'high' | 'xhigh'; attachments?: AttachmentRef[] }, key: string) {
    const body = z.object({ prompt: promptSchema, model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
      mode: z.enum(['build', 'plan']).optional(), effort: z.enum(['low', 'standard', 'high', 'xhigh']).optional(), attachments: attachmentRefsSchema.optional() }).strict().parse(input)
    return this.json(sessionSchema, `/projects/${id.parse(projectId)}/sessions`, { method: 'POST', body, key: keySchema.parse(key) })
  }
  session(sessionId: string, signal?: AbortSignal) { return this.json(sessionSchema, `/sessions/${id.parse(sessionId)}`, { signal }) }
  async desktopTicket(sessionId: string) {
    const encodedId = encodeURIComponent(id.parse(sessionId))
    const ticket = await this.json(desktopTicketSchema, `/sessions/${encodedId}/desktop-ticket`, { method: 'POST' })
    if (ticket.path !== `/sessions/${encodedId}/desktop`) {
      throw new BackendError(502, 'response/invalid', 'The server returned an invalid desktop ticket.')
    }
    return ticket
  }
  messages(sessionId: string, signal?: AbortSignal) { return this.json(z.object({ messages: z.array(messageSchema) }), `/sessions/${id.parse(sessionId)}/messages?limit=200`, { signal }) }
  queuedMessages(sessionId: string, signal?: AbortSignal) { return this.json(z.object({ queuedMessages: z.array(queuedSchema), nextCursor: z.string().nullable() }), `/sessions/${id.parse(sessionId)}/queued-messages?limit=100`, { signal }) }
  sendMessage(sessionId: string, input: { prompt: string; steer?: boolean; mode?: 'build' | 'plan'; attachments?: AttachmentRef[]; inputResponse?: { id: string; answer: string } }, key: string) {
    const body = z.object({ prompt: promptSchema, steer: z.boolean().optional(), mode: z.enum(['build', 'plan']).optional(), attachments: attachmentRefsSchema.optional(),
      inputResponse: z.object({ id, answer: promptSchema }).strict().optional() }).strict().parse(input)
    return this.json(acceptedMessageSchema, `/sessions/${id.parse(sessionId)}/messages`, { method: 'POST', body, key: keySchema.parse(key) })
  }
  /** Uploads one image as a raw body; the server answers with the reference a message can carry. */
  uploadAttachment(file: Blob, signal?: AbortSignal) {
    if (!isAttachmentMediaType(file.type)) throw new BackendError(415, 'attachment/unsupported-type', 'Attach a PNG, JPEG, WebP or GIF image.')
    return this.json(storedAttachmentSchema, '/attachments', { method: 'POST', raw: { body: file, contentType: file.type }, signal })
  }
  /** The caller's own upload, as bytes; the server refuses anyone else's. */
  async attachmentBlob(attachmentId: string, signal?: AbortSignal) {
    const response = await this.response(`/attachments/${z.string().uuid().parse(attachmentId)}`, { signal })
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!isAttachmentMediaType(type)) throw new BackendError(502, 'response/invalid', 'The server returned an unexpected attachment type.')
    return response.blob()
  }
  continueSession(sessionId: string, input: { checkpointId: string; lane: 'premium' | 'fallback'; model: string; effort: 'low' | 'standard' | 'high' | 'xhigh' }, key: string) {
    const body = z.object({ checkpointId: id, lane: z.enum(['premium', 'fallback']), model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/), effort: z.enum(['low', 'standard', 'high', 'xhigh']) }).strict().parse(input)
    return this.json(sessionSchema, `/sessions/${id.parse(sessionId)}/continuation`, { method: 'POST', body, key: keySchema.parse(key) })
  }

  cancel(sessionId: string, key: string) { return this.json(sessionSchema, `/sessions/${id.parse(sessionId)}/cancel`, { method: 'POST', key: keySchema.parse(key) }) }

  /** One connection. Caller owns reconnect UI/backoff; control frames never advance the resume cursor. */
  async events(sessionId: string, options: { signal: AbortSignal; after?: string; onOpen?: () => void; onEvent: (event: SessionEvent) => void | Promise<void> }) {
    const response = await this.response(`/sessions/${id.parse(sessionId)}/events`, { signal: options.signal, after: options.after })
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) {
      throw new BackendError(502, 'stream/invalid', 'The server did not return an event stream.')
    }
    options.onOpen?.()
    await readEvents(response.body, options.onEvent)
  }
}

// Keep in sync with the server's prompt contract; server validation remains authoritative.
const promptSchema = z.string().trim().min(1).max(8000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/)

/** Bounded incremental SSE parser; chunk boundaries, CRLF and UTF-8 boundaries are unrelated to frames. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: SessionEvent) => void | Promise<void>) {
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true })
  let pending = ''; let data: string[] = []; let type = 'message'; let eventId: string | undefined
  let frameLength = 0
  const line = async (value: string) => {
    frameLength += value.length
    if (frameLength > 1_048_576) throw new BackendError(502, 'stream/too-large', 'Event exceeds the client size limit.')
    if (value === '') {
      if (data.length) {
        let parsed: unknown
        try { parsed = JSON.parse(data.join('\n')) }
        catch { throw new BackendError(502, 'stream/invalid-json', 'The event stream contains invalid JSON.') }
        const payload = z.record(z.string(), z.unknown()).safeParse(parsed)
        if (!payload.success) throw new BackendError(502, 'stream/invalid-data', 'The event stream contains an invalid payload.')
        await onEvent({ ...(eventId === undefined ? {} : { id: eventId }), type, data: payload.data })
      }
      data = []; type = 'message'; eventId = undefined; frameLength = 0; return
    }
    if (value.startsWith(':')) return
    const split = value.indexOf(':'); const field = split === -1 ? value : value.slice(0, split)
    const content = split === -1 ? '' : value.slice(split + 1).replace(/^ /, '')
    if (field === 'data') data.push(content)
    else if (field === 'event') type = content
    else if (field === 'id') eventId = streamId.parse(content)
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let index: number
      while ((index = pending.indexOf('\n')) !== -1) {
        const next = pending.slice(0, index).replace(/\r$/, ''); pending = pending.slice(index + 1)
        await line(next)
      }
      if (pending.length + frameLength > 1_048_576) throw new BackendError(502, 'stream/too-large', 'Event exceeds the client size limit.')
      if (done) {
        if (pending.length || data.length) throw new BackendError(502, 'stream/truncated', 'The event stream ended within a frame. Resume from the last accepted event.')
        break
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
