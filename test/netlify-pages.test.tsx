import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { NetlifyDeployment } from '../lib/backend/netlify'

const require = createRequire(import.meta.url)
const pending: NetlifyDeployment = { id: 'd1', projectId: 'p1', ownerUid: 'u', connectionId: 'c1', sessionId: 's1',
  title: 'First project build', accountSlug: 'team', publishDirectory: 'out', buildCommand: 'npm run build',
  sha256: 'a'.repeat(64), bytes: 100, files: 1, createdAt: '2026-11-16T12:00:00Z', expiresAt: '2026-11-16T13:00:00Z', status: 'awaiting_approval' }

/** Run the existing page's hooks and handlers with controlled backend responses. */
function mount(page: 'setup' | 'deployments', backend: Record<string, any>, query: URLSearchParams) {
  const slots: any[] = []; let cursor = 0; let dirty = true; let tree: React.ReactNode
  const effects: (() => void)[] = []
  const replacements: string[] = []
  const react = { ...React,
    useState(initial: any) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value: any) => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true } }]
    },
    useRef(current: any) { const index = cursor++; return slots[index] ??= { current } },
    useEffect(effect: () => (() => void) | void, deps: unknown[]) {
      const index = cursor++; const old = slots[index]
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
      }
    },
  }
  const name = page === 'setup' ? 'Complete' : 'Deployments'
  const source = readFileSync(new URL(`../app/integrations/netlify/${page}/page.tsx`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(`${source}\nexports.TestPage = ${name}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} as { TestPage: () => React.ReactNode } }
  const identity = { uid: 'u' }
  const isolatedRequire = (id: string): any => {
    if (id === 'react') return react
    if (id === 'next/navigation') return { useSearchParams: () => query }
    if (id === 'next/link') return { __esModule: true, default: (props: any) => React.createElement('a', props) }
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ user: identity }) }
    if (id === '@/lib/backend/browser') return { currentBackend: () => backend }
    if (id === '@/components/ui/navbar' || id === '@/components/auth/protected-route') return {}
    if (id.endsWith('.module.css')) return { __esModule: true, default: {} }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  const window = { location: { origin: 'https://app.test', pathname: '/integrations/netlify/setup' }, history: { replaceState: (_data: unknown, _title: string, url: string) => replacements.push(url) } }
  new Function('require', 'module', 'exports', 'window', compiled)(isolatedRequire, module, module.exports, window)
  const render = () => { cursor = 0; dirty = false; tree = module.exports.TestPage(); effects.splice(0).forEach(effect => effect()) }
  render()
  return {
    replacements,
    html: () => renderToStaticMarkup(tree),
    async settle() { for (let i = 0; i < 8; i++) { await setImmediate(); if (dirty) render() } },
    find(predicate: (element: React.ReactElement<any>) => boolean) {
      function visit(node: React.ReactNode): React.ReactElement<any> | undefined {
        if (Array.isArray(node)) return node.map(visit).find(Boolean)
        if (!React.isValidElement<any>(node)) return
        const element = node as React.ReactElement<Record<string, any>>
        return predicate(element) ? element : visit(element.props.children)
      }
      const found = visit(tree); assert.ok(found); return found.props
    },
    close() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}

test('OAuth denial never exchanges a code; success explains project access and preparation', async () => {
  let calls = 0
  const backend = { completeNetlifyConnection: async () => { calls++; return { connection: { account: { name: 'My team' } } } } }
  const denied = mount('setup', backend, new URLSearchParams('error=access_denied&code=discard&state=discard'))
  await denied.settle()
  assert.equal(calls, 0)
  assert.match(denied.html(), /role="alert"/)
  assert.match(denied.html(), /Netlify was not connected/)
  assert.deepEqual(denied.replacements, ['https://app.test/integrations/netlify/setup'])
  denied.close()
  const success = mount('setup', backend, new URLSearchParams('code=code&state=state'))
  assert.match(success.html(), /Finishing the Netlify connection/)
  await success.settle()
  assert.equal(calls, 1)
  assert.match(success.html(), /Grant project access and enable deployment preparation/)
  assert.match(success.html(), /href="\/integrations#integration-access"/)
  success.close()
  const failed = mount('setup', { completeNetlifyConnection: async () => { throw new Error('Raw secret diagnostic') } }, new URLSearchParams('code=code&state=state'))
  await failed.settle()
  assert.match(failed.html(), /connection could not be confirmed/)
  assert.doesNotMatch(failed.html(), /Raw secret/)
  failed.close()
})

test('switching projects clears history immediately and ignores an interrupted old response', async () => {
  let resolve!: (value: unknown) => void
  const backend = { projects: async () => ({ projects: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }] }),
    netlifyDeployments: async (id: string) => id === 'p1' ? new Promise(done => { resolve = done }) : { deployments: [] } }
  const page = mount('deployments', backend, new URLSearchParams('projectId=p1'))
  assert.match(page.html(), /Loading projects|Loading deployments/)
  await page.settle()
  page.find(element => element.type === 'select').onChange({ target: { value: 'p2' } })
  await page.settle()
  assert.match(page.html(), /No deployments yet/)
  resolve({ deployments: [pending] })
  await page.settle()
  assert.doesNotMatch(page.html(), /First project build/)
  assert.match(page.html(), /href="\/project\/p2"/)
  page.close()
})

test('approval expires while open, and a stale click never publishes', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-11-16T12:59:59Z') })
  let approved = 0
  const backend = { projects: async () => ({ projects: [{ id: 'p1', name: 'One' }] }), netlifyDeployments: async () => ({ deployments: [pending] }),
    approveNetlifyDeployment: async () => { approved++; return { deployment: pending } } }
  const page = mount('deployments', backend, new URLSearchParams('projectId=p1'))
  await page.settle()
  const oldCard = page.find(element => element.props.record?.id === 'd1')
  assert.match(page.html(), /Approve and publish/)
  t.mock.timers.tick(1001)
  await page.settle()
  assert.match(page.html(), /Build review expired/)
  assert.doesNotMatch(page.html(), /Approve and publish/)
  oldCard.onSubmit('approve')
  await page.settle()
  assert.equal(approved, 0)
  page.close()
})

test('approval is single flight; an interrupted outcome is shown without replaying publication', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-11-16T12:10:00Z') })
  let reject!: (error: Error) => void; let approvals = 0
  const backend = { projects: async () => ({ projects: [{ id: 'p1', name: 'One' }] }), netlifyDeployments: async () => ({ deployments: [pending] }),
    approveNetlifyDeployment: async () => { approvals++; return new Promise((_done, fail) => { reject = fail }) } }
  const page = mount('deployments', backend, new URLSearchParams('projectId=p1'))
  await page.settle()
  const card = page.find(element => element.props.record?.id === 'd1')
  card.onSubmit('approve'); card.onSubmit('approve')
  await page.settle()
  assert.equal(approvals, 1)
  assert.match(page.html(), /disabled=""/)
  reject(new Error('Raw upload diagnostic'))
  await page.settle()
  assert.match(page.html(), /outcome could not be confirmed/)
  assert.doesNotMatch(page.html(), /Raw upload diagnostic/)
  assert.equal(approvals, 1)
  page.close()
})

test('loading failures are actionable and cancellation uses the existing backend action only', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-11-16T12:10:00Z') })
  const failed = mount('deployments', {
    projects: async () => { throw new Error('Raw projects diagnostic') },
    netlifyDeployments: async () => { throw new Error('Raw deployments diagnostic') },
  }, new URLSearchParams('projectId=p1'))
  await failed.settle()
  assert.match(failed.html(), /Projects could not be loaded/)
  assert.match(failed.html(), /Deployments could not be loaded/)
  assert.doesNotMatch(failed.html(), /Raw .*diagnostic/)
  failed.close()
  let record = pending; const rejected: string[][] = []
  const page = mount('deployments', {
    projects: async () => ({ projects: [{ id: 'p1', name: 'One' }] }),
    netlifyDeployments: async () => ({ deployments: [record] }),
    rejectNetlifyDeployment: async (project: string, id: string) => { rejected.push([project, id]); record = { ...record, status: 'rejected' }; return { deployment: record } },
  }, new URLSearchParams('projectId=p1'))
  await page.settle()
  page.find(element => element.props.record?.id === 'd1').onSubmit('reject')
  await page.settle()
  assert.deepEqual(rejected, [['p1', 'd1']])
  assert.match(page.html(), /Cancelled/)
  assert.doesNotMatch(page.html(), /Approve and publish/)
  page.close()
})
