/** One instance belongs to one authenticated account, environment and grant lifetime. */
type Entry = {
  controller: AbortController; pending?: Promise<unknown>; value?: unknown; expires: number; readers: number
}

export function delay(ms: number, signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export class PrivateQueries {
  private entries = new Map<string, Entry>()
  private closed = false
  readonly metrics = { requests: 0, hits: 0, misses: 0, coalesced: 0, retries: 0 }
  constructor(private now = Date.now, private wait = delay) {}

  invalidate(prefix = '') {
    for (const [key, entry] of this.entries) {
      if (key.startsWith(prefix)) { this.entries.delete(key); entry.controller.abort() }
    }
  }

  close() { this.closed = true; this.invalidate() }

  async read<T>(key: string, freshnessMs: number, signal: AbortSignal | undefined,
    load: (signal: AbortSignal) => Promise<T>): Promise<T> {
    signal?.throwIfAborted()
    if (this.closed) throw new DOMException('Account changed.', 'AbortError')
    let entry = this.entries.get(key)
    if (entry && !entry.pending && entry.expires > this.now()) {
      this.metrics.hits++
      return entry.value as T
    }
    if (!entry?.pending) {
      this.metrics.misses++
      // Expired pages and event cursors must not accumulate over a long login.
      for (const [k, e] of this.entries) if (!e.pending && e.expires <= this.now()) this.entries.delete(k)
      entry = { controller: new AbortController(), expires: 0, readers: 0 }
      this.entries.set(key, entry)
      const current = entry
      const shared = current.controller.signal
      current.pending = Promise.resolve().then(async () => {
        for (let attempt = 0; ; attempt++) {
          shared.throwIfAborted()
          try {
            this.metrics.requests++
            const value = await load(shared)
            shared.throwIfAborted()
            if (freshnessMs > 0) {
              current.value = value
              current.expires = this.now() + freshnessMs
            }
            return value
          } catch (error) {
            shared.throwIfAborted()
            const status = (error as {status?: number} | null)?.status
            if (attempt >= 2 || !(error instanceof TypeError || [502, 503, 504].includes(status ?? 0))) throw error
            this.metrics.retries++
            await this.wait(200 * 2 ** attempt + Math.random() * 100, shared)
          }
        }
      }).finally(() => {
        current.pending = undefined
        if (!current.expires && this.entries.get(key) === current) this.entries.delete(key)
      })
    } else this.metrics.coalesced++

    const active = entry
    active.readers++
    return new Promise<T>((resolve, reject) => {
      let done = false
      const release = () => {
        if (done) return
        done = true
        signal?.removeEventListener('abort', abort)
        if (--active.readers === 0 && active.pending && this.entries.get(key) === active) {
          this.entries.delete(key)
          active.controller.abort()
        }
      }
      const abort = () => { release(); reject(signal?.reason) }
      signal?.addEventListener('abort', abort, {once: true})
      active.pending!.then(value => {
        if (active.controller.signal.aborted) reject(active.controller.signal.reason)
        else resolve(value as T)
      }, reject).finally(release)
    })
  }
}

/** Persist only an opaque ID and digest in tab storage, never the prompt or token. */
export async function operationIdentity(storage: Pick<Storage, 'getItem'|'setItem'|'removeItem'>,
  scope: readonly string[], payload: readonly (string | number | null)[]) {
  const bytes = new TextEncoder().encode(JSON.stringify([scope, payload]))
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    n => n.toString(16).padStart(2, '0')).join('')
  const slot = `lotus:pending:${digest}`
  const id = storage.getItem(slot) ?? crypto.randomUUID()
  storage.setItem(slot, id)
  return { id, confirmed() { if (storage.getItem(slot) === id) storage.removeItem(slot) } }
}
