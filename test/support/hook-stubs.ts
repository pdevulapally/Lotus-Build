/**
 * Runs `useBackendSession` against a controllable backend: jsdom for React DOM, and the browser client, stream and
 * snapshot modules replaced at the module layer. Tests drive the stream through the handlers the hook registered.
 * Load with `--import ./test/support/hook-stubs.ts` before the test file (tsx compiles tests to CJS: no top-level await).
 */
import Module from 'node:module'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/' })
const g = globalThis as unknown as Record<string, unknown>
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  const value = (dom.window as unknown as Record<string, unknown>)[key]
  if (value !== undefined && g[key] === undefined) g[key] = value
}
if (g['requestAnimationFrame'] === undefined) { g['requestAnimationFrame'] = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0); g['cancelAnimationFrame'] = (h: number) => clearTimeout(h) }
process.env['NEXT_PUBLIC_BACKEND_URL'] ??= 'http://backend.local'
process.env['NEXT_PUBLIC_APP_URL'] ??= 'http://localhost:3000'
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export type StreamHandlers = Parameters<typeof import('../../lib/backend/session-events').followSessionEvents>[2]
export const harness: {
  streams: { sessionId: string; handlers: StreamHandlers }[]
  intercepted: string[]
  snapshot: (id: string) => { session: Record<string, unknown>; project: Record<string, unknown>; messages: unknown[]; queued: unknown[] }
} = {
  streams: [],
  intercepted: [],
  snapshot: () => { throw new Error('snapshot not configured') },
}

const client = new Proxy({}, { get: (_t, name) => (..._args: unknown[]) => (name === 'listFiles' ? Promise.resolve({ files: [] }) : new Promise(() => {})) })
const stubs: Record<string, unknown> = {
  [path.resolve('lib/backend/browser.ts')]: { currentBackend: () => client },
  [path.resolve('lib/backend/session-events.ts')]: {
    followSessionEvents: (_client: unknown, sessionId: string, handlers: StreamHandlers) => new Promise<void>((resolve) => {
      // As the real stream does: hydration runs alongside the stream, through the hook's own reconcile.
      harness.streams.push({ sessionId, handlers }); void handlers.onReconcile?.(); handlers.onConnected?.(); handlers.signal.addEventListener('abort', () => resolve(), { once: true })
    }),
  },
  [path.resolve('lib/backend/session-snapshot.ts')]: {
    loadSessionSnapshot: async (_client: unknown, id: string, _signal: AbortSignal, onOwned?: (s: unknown, p: unknown) => void) => {
      const data = harness.snapshot(id); onOwned?.(data.session, data.project); return data
    },
    sessionEventStatus: { 'session.running': 'RUNNING', 'session.queued': 'QUEUED', 'session.idle': 'IDLE', 'session.stopped': 'STOPPED', 'session.failed': 'FAILED' },
  },
}
const load = (Module as unknown as { _load: (request: string, parent: { filename?: string } | undefined, isMain: boolean) => unknown })._load
;(Module as unknown as { _load: unknown })._load = function (request: string, parent: { filename?: string } | undefined, isMain: boolean) {
  const bare = request.startsWith('@/') ? path.resolve(request.slice(2)) : path.isAbsolute(request) ? request : parent?.filename && request.startsWith('.') ? path.resolve(path.dirname(parent.filename), request) : undefined
  if (bare !== undefined) { const base = bare.replace(/\.(ts|tsx|js)$/, ''); for (const ext of ['', '.ts', '.tsx']) { const stub = stubs[base + ext]; if (stub !== undefined) { harness.intercepted.push(request); return stub } } }
  return load.call(this, request, parent, isMain)
}
