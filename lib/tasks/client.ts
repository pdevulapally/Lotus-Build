import { taskSessionSchema, type ApprovalDecision } from './contract'

export class TaskApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'TaskApiError' }
}
type Options = { origin: string; token: (force?: boolean) => Promise<string>; fetch?: typeof fetch }
/** Separate explicit origin keeps the staged replacement away from the legacy server. */
export class TaskClient {
  private readonly origin: string
  private readonly fetcher: typeof fetch
  constructor(private readonly options: Options) {
    const url = new URL(options.origin)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Configure a secure agent API origin without a path.')
    this.origin = url.origin; this.fetcher = options.fetch ?? fetch
  }
  private async request(path: string, method: string, body?: unknown, key?: string, signal?: AbortSignal) {
    signal?.throwIfAborted()
    const token = await this.options.token()
    signal?.throwIfAborted()
    const response = await this.fetcher(`${this.origin}${path}`, { method, signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof data?.detail === 'string' ? data.detail : response.status === 422 ? 'The request was not accepted. Check your input.' : 'The request could not be completed.'
      throw new TaskApiError(response.status, message)
    }
    const parsed = taskSessionSchema.safeParse(data)
    if (!parsed.success) throw new TaskApiError(502, 'The agent API returned an unsupported response. No action was assumed successful.')
    return parsed.data
  }
  create(task: string, kind: 'code' | 'desktop', key: string, signal?: AbortSignal) { return this.request('/sessions', 'POST', { task, kind }, key, signal) }
  read(id: string, signal?: AbortSignal) { return this.request(`/sessions/${encodeURIComponent(id)}`, 'GET', undefined, undefined, signal) }
  message(id: string, content: string, key: string, signal?: AbortSignal) { return this.request(`/sessions/${encodeURIComponent(id)}/messages`, 'POST', { content }, key, signal) }
  approve(id: string, approval_id: string, decisions: ApprovalDecision[], key: string, signal?: AbortSignal) { return this.request(`/sessions/${encodeURIComponent(id)}/approve`, 'POST', { approval_id, decisions }, key, signal) }
  cancel(id: string, signal?: AbortSignal) { return this.request(`/sessions/${encodeURIComponent(id)}`, 'DELETE', undefined, undefined, signal) }
}
