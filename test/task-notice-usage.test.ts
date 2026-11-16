import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import ts from 'typescript'
import type { BackendSession, BackendUsage } from '../lib/backend/client'
import type { TaskNoticeUsage } from '../lib/backend/task-notice'
import type { useTaskNoticeUsage } from '../hooks/use-task-notice-usage'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../hooks/use-task-notice-usage.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const now = Date.UTC(2026, 10, 15, 23, 59, 59)
const paused: BackendSession = { id: 's', projectId: 'p', model: 'model', effort: 'high', mode: 'build', status: 'IDLE', messageCount: 1,
  createdAt: new Date(now).toISOString(), fallback: { status: 'AWAITING_CREDITS', reason: 'Paused', resumable: true,
    consent: false, checkpointId: 'saved', resetAt: new Date(now + 1000).toISOString() } }
const usage: BackendUsage = { uid: 'u', plan: { key: 'pro', name: 'Pro' }, meters: [] }

/** Exercise the hook's actual effects with controlled usage reads; no task client is provided. */
function mount(read: (signal?: AbortSignal) => Promise<BackendUsage>, session = paused) {
  const effects: (() => (() => void) | void)[] = []
  const states: { scope: string; state: TaskNoticeUsage }[] = []
  const window = new EventTarget()
  const module = { exports: {} as { useTaskNoticeUsage: typeof useTaskNoticeUsage } }
  const isolatedRequire = (id: string) => {
    if (id === 'react') return {
      useCallback: (fn: unknown) => fn,
      useState: (initial: unknown) => [initial, (value: unknown) => { if (typeof value !== 'function') states.push(value as typeof states[number]) }],
      useEffect: (effect: typeof effects[number]) => effects.push(effect),
    }
    if (id === '@/lib/backend/browser') return { currentBackend: () => ({ usage: read }) }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  new Function('require', 'module', 'exports', 'window', compiled)(isolatedRequire, module, module.exports, window)
  module.exports.useTaskNoticeUsage(session, 'u')
  const cleanup = effects[0]()
  return { states, focus: () => window.dispatchEvent(new Event('focus')), cleanup: () => cleanup?.() }
}

test('paused task refreshes usage on focus and reset without any continuation call', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now })
  let reads = 0
  const hook = mount(async () => { reads++; return usage })
  await setImmediate()
  assert.equal(reads, 1)
  assert.equal(hook.states.at(-1)?.state.status, 'ready')
  hook.focus()
  await setImmediate()
  assert.equal(reads, 2)
  t.mock.timers.tick(1001)
  await setImmediate()
  assert.equal(reads, 3)
  hook.cleanup()
  hook.focus()
  t.mock.timers.tick(1000)
  await setImmediate()
  assert.equal(reads, 3)
})

test('failed usage read hides old balance and still refreshes at the saved reset', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now })
  let reads = 0
  const hook = mount(async () => { if (++reads === 1) throw new Error('Offline'); return usage })
  await setImmediate()
  assert.equal(hook.states.at(-1)?.state.status, 'unavailable')
  t.mock.timers.tick(1001)
  await setImmediate()
  assert.equal(reads, 2)
  assert.equal(hook.states.at(-1)?.state.status, 'ready')
  hook.cleanup()
})

test('leaving a paused task aborts its usage read and ignores late data; running tasks do not fetch', async () => {
  let signal: AbortSignal | undefined
  let resolve!: (value: BackendUsage) => void
  const hook = mount(next => { signal = next; return new Promise(done => { resolve = done }) })
  hook.cleanup()
  assert.equal(signal?.aborted, true)
  resolve(usage)
  await setImmediate()
  assert.equal(hook.states.at(-1)?.state.status, 'loading')
  let reads = 0
  const running = mount(async () => { reads++; return usage }, { ...paused, status: 'RUNNING' })
  await setImmediate()
  assert.equal(reads, 0)
  running.cleanup()
})
