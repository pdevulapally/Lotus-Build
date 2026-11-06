import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { isValidElement, type ReactNode } from 'react'
import ts from 'typescript'
import type { AnimatedAIInput } from '../components/ui/animated-ai-input'
import { pendingBuild } from '../lib/backend/create-build'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/ui/animated-ai-input.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function elements(node: ReactNode): Record<string, any>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, any>
  return [props, ...elements(props.children)]
}

test('slow creation acknowledges immediately, blocks duplicate clicks, retains input on failure and retries its original session key', async (t) => {
  const slots: unknown[] = []; let index = 0; let mounted = false
  const react = {
    useState(value: unknown) { const slot = index++; if (!mounted) slots[slot] = value; return [slots[slot], (next: unknown) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next }] },
    useRef(value: unknown) { const slot = index++; if (!mounted) slots[slot] = { current: value }; return slots[slot] },
    useCallback: (callback: unknown) => callback, useEffect: () => {},
  }
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
  t.after(() => { if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage); else Reflect.deleteProperty(globalThis, 'sessionStorage') })
  let release!: () => void; const projectReady = new Promise<void>((resolve) => { release = resolve })
  let projects = 0; let sessions = 0; let cleared = 0; const keys: string[] = []; const navigations: string[] = []
  const refs = [{ id: 'd13cc2d1-d383-4ea5-a2dd-90f334e145d0', mediaType: 'image/png' as const }]
  const backend = {
    createProject: async () => { projects++; await projectReady; return { id: 'p' } },
    createSession: async (_id: string, body: { prompt: string; attachments: unknown }, key: string) => {
      sessions++; keys.push(key); assert.equal(body.prompt, 'Build my app'); assert.deepEqual(body.attachments, refs)
      if (sessions === 1) throw new Error('Session creation failed')
      return { id: 'confirmed-session', createdAt: '2026-11-06T10:00:00.000Z' }
    },
  }
  const module = { exports: {} as { AnimatedAIInput: typeof AnimatedAIInput } }
  const isolatedRequire = (id: string) => {
    if (id === 'react') return react
    if (id === 'next/navigation') return { useRouter: () => ({ push: (path: string) => { navigations.push(path) } }) }
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ user: { uid: 'alice' }, account: { models: [{ id: 'configured', name: 'Configured' }], plan: { name: 'Business' } } }) }
    if (id === '@/lib/backend/browser') return { currentBackend: () => backend }
    if (id === '@/lib/backend/pending-storage') return { pendingCommandStorage: () => storage }
    if (id === '@/components/ui/request-error') return { RequestErrorNotice: () => null }
    if (id === '@/hooks/use-composer-attachments') return { useComposerAttachments: () => ({ items: [], refs, clear: () => { cleared++ } }) }
    if (id === '@/hooks/use-voice-dictation') return { useVoiceDictation: () => ({ supported: false }), VOICE_ERRORS: {} }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  const render = () => { index = 0; const node = module.exports.AnimatedAIInput({}); mounted = true; return elements(node) }
  let view = render()
  view.find((props) => typeof props.onKeyDown === 'function' && 'value' in props)!.onChange({ target: { value: 'Build my app' } })
  view = render()
  const submit = view.find((props) => props['aria-label'] === 'Start project')!.onClick
  const first = submit(); await submit()
  view = render()
  assert.equal(projects, 1); assert.equal(sessions, 0); assert.deepEqual(navigations, [])
  assert.ok(view.some((props) => props.role === 'status' && props.children === 'Submitting your request…'))
  assert.ok(view.some((props) => props.value === 'Build my app' && props.disabled))
  assert.equal(cleared, 0)
  release(); await first
  assert.equal(pendingBuild(storage, 'alice')?.projectId, 'p')
  view = render(); assert.ok(view.some((props) => props.error?.message === 'Session creation failed'))
  assert.equal(cleared, 0); assert.deepEqual(navigations, [])
  await view.find((props) => props['aria-label'] === 'Start project')!.onClick()
  assert.equal(projects, 1); assert.equal(sessions, 2); assert.equal(keys[0], keys[1]); assert.equal(cleared, 1)
  assert.deepEqual(navigations, ['/computer/confirmed-session']); assert.equal(pendingBuild(storage, 'alice'), null)
})
