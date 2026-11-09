import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider, useAuth, workspaceStorageKey } from '../../contexts/auth-context'
import { AnimatedAIInput } from '../../components/ui/animated-ai-input'
import { auth } from '../support/stubs/firebase'
import { backend, gate } from '../support/stubs/backend-browser'
import { navigation } from '../support/stubs/next-navigation'

/**
 * The real `AuthProvider` resolving the current workspace's models, and the real composer consuming them, mounted
 * with React DOM in jsdom; Firebase Auth and the backend client are the doubles the test drives. The fixture backend
 * answers `models` per workspace: `free-small` for an account, `teams-large` for Acme (org1), `beta-model` for Beta (org2).
 */
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
const controls: { switchWorkspace?: (id: string) => Promise<void>; models?: readonly { id: string }[] | null; workspace?: string } = {}
function Probe() {
  const { switchWorkspace, models, currentWorkspace } = useAuth()
  controls.switchWorkspace = switchWorkspace; controls.models = models; controls.workspace = currentWorkspace?.id
  return null
}
const tree = (initialModel?: string) => createElement(AuthProvider, null, createElement(Probe), createElement(AnimatedAIInput, { mode: 'create', ...(initialModel ? { initialModel } : {}) }))
const mounted: (() => Promise<void>)[] = []
const mount = async (initialModel?: string) => {
  for (const leftover of mounted.splice(0)) await leftover()
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  await act(async () => { root = createRoot(container) })
  await act(async () => { root.render(tree(initialModel)) })
  const unmount = async () => { await act(async () => root.unmount()); container.remove(); mounted.splice(mounted.indexOf(unmount), 1) }
  mounted.push(unmount)
  return { unmount }
}
const ids = () => controls.models === null || controls.models === undefined ? controls.models : controls.models.map((model) => model.id)
const modelCalls = () => backend.calls.filter((call) => call.startsWith('models:'))
const switchTo = async (id: string) => { await act(async () => { await controls.switchWorkspace!(id) }); await flush() }
const unhandled: unknown[] = []
process.on('unhandledRejection', (reason) => { unhandled.push(reason) })
const reset = () => { unhandled.length = 0; backend.reset(); navigation.pushes.length = 0; window.localStorage.clear(); if (auth.currentUser) auth.signOut() }
const textarea = () => document.querySelector('textarea')!
const type = async (value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => { setter.call(textarea(), value); textarea().dispatchEvent(new Event('input', { bubbles: true })) })
}
const submitButton = () => [...document.querySelectorAll('button')].find((b) => /Create project|Send|Start/i.test(b.getAttribute('aria-label') ?? '')) ?? [...document.querySelectorAll('button[type="button"]')].at(-1)!
const submit = async () => { await act(async () => { submitButton().dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await flush(); await flush() }

test('a Free account sees its own models; selecting the Teams organisation offers the organisation\'s models in the composer', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  assert.deepEqual(ids(), ['free-small'], 'personal workspace: the account\'s own models, no models request')
  assert.deepEqual(modelCalls(), [])
  assert.match(text(), /Free Small/)
  await switchTo('org1')
  assert.deepEqual(modelCalls(), ['models:org1'])
  assert.deepEqual(ids(), ['teams-large'])
  assert.match(text(), /Teams Large/); assert.doesNotMatch(text(), /Free Small/)
  await page.unmount()
})

test('org A → org B while A\'s answer is still pending: nothing is offered until B answers, and A\'s late answer is dropped; back to personal is immediate', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  const slowA = gate(); backend.modelGates.set('org1', slowA)
  await switchTo('org1')
  assert.equal(ids(), null, 'unknown while Acme\'s models are pending — not the personal list')
  assert.doesNotMatch(text(), /Free Small|Teams Large/)
  await switchTo('org2')
  assert.deepEqual(ids(), ['beta-model'])
  slowA.open(); await flush(); await flush()
  assert.deepEqual(ids(), ['beta-model'], 'Acme\'s late answer does not replace Beta\'s models')
  assert.match(text(), /Beta Model/); assert.doesNotMatch(text(), /Teams Large/)
  await switchTo('alice')
  assert.deepEqual(ids(), ['free-small'])
  assert.deepEqual(modelCalls(), ['models:org1', 'models:org2'], 'the personal workspace never asks the server')
  await page.unmount()
})

test('sign-out and another account signing in: the first account\'s pending organisation answer never becomes the second\'s models', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  const slowA = gate(); backend.modelGates.set('org1', slowA)
  await switchTo('org1')
  assert.equal(ids(), null)
  await act(async () => { auth.signOut() }); await flush()
  assert.equal(ids(), null, 'signed out: nothing')
  await act(async () => { auth.signIn('bob') }); await flush()
  assert.deepEqual(ids(), ['free-small'], 'Bob starts in his personal workspace')
  slowA.open(); await flush(); await flush()
  assert.deepEqual(ids(), ['free-small'], 'Alice\'s Acme answer is not Bob\'s')
  assert.doesNotMatch(text(), /Teams Large/)
  assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('a failed organisation models fetch leaves the models unknown — not the previous workspace\'s list — and the composer refuses to submit', async () => {
  reset(); auth.signIn('alice'); backend.modelFailures.add('org2')
  const page = await mount(); await flush()
  await switchTo('org1')
  assert.deepEqual(ids(), ['teams-large'])
  await switchTo('org2')
  assert.equal(ids(), null, 'Beta\'s fetch failed: unknown, not Acme\'s or the account\'s models')
  assert.doesNotMatch(text(), /Teams Large|Free Small/)
  await type('Build me a landing page'); await submit()
  assert.match(text(), /No models are currently available/)
  assert.equal(backend.calls.some((call) => /^(create|build|project)/.test(call)), false, 'nothing was created')
  assert.deepEqual(navigation.pushes, [])
  assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('a model chosen in the organisation is not submittable after switching to a workspace whose plan lacks it', async () => {
  reset(); auth.signIn('alice'); window.localStorage.setItem(workspaceStorageKey('alice'), 'org1')
  const page = await mount('teams-large'); await flush()
  assert.equal(controls.workspace, 'org1')
  assert.match(text(), /Teams Large/, 'the chosen model is offered in Acme')
  await switchTo('alice')
  assert.deepEqual(ids(), ['free-small'])
  assert.doesNotMatch(text(), /Teams Large/, 'the stale choice is not shown as selected')
  await type('Build me a landing page'); await submit()
  assert.match(text(), /The selected model is no longer available/)
  assert.equal(backend.calls.some((call) => /^(create|build|project)/.test(call)), false, 'the stale model was not submitted')
  assert.deepEqual(navigation.pushes, [])
  await page.unmount()
})
