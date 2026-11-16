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
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/publish-popover.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const review: NetlifyDeployment = { id: 'd1', ownerUid: 'u', projectId: 'p1', sessionId: 's1', connectionId: 'c1', title: 'Prepared build',
  accountSlug: 'team', buildCommand: 'npm run build', publishDirectory: 'out', files: 2, bytes: 50, sha256: 'a'.repeat(64),
  createdAt: '2026-11-16T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', status: 'awaiting_approval' }

/** Run the actual popover handlers/effects with fixture services, never a real agent or provider. */
function mount(options: { records?: NetlifyDeployment[]; available?: boolean; blocked?: string; rejectPreparation?: boolean } = {}) {
  const slots: any[] = []; let cursor = 0; let dirty = true; let tree: any
  const effects: (() => void)[] = []
  let prepared = 0; const approvals: unknown[][] = []
  let records = options.records ?? []
  const backend = {
    netlifyDeployments: async () => ({ deployments: records }),
    refreshNetlifyDeployment: async (_project: string, id: string) => ({ deployment: records.find(record => record.id === id) }),
    connectionCatalogue: async () => ({ connectors: options.available === false ? [] : [{ key: 'netlify', auth: 'netlify-oauth', status: 'available' }] }),
    connections: async () => ({ connections: [{ id: 'c1', connector: 'netlify', status: 'active' }] }),
    connection: async () => ({ connection: { grantedProjectIds: ['p1'] } }),
    pluginTools: async () => ({ tools: [{ name: 'deploy', mode: 'always' }] }),
    approveNetlifyDeployment: async (...args: unknown[]) => {
      approvals.push(args)
      const ready = { ...review, status: 'ready' as const, deployUrl: 'https://deploy.netlify.app/' }
      records = [ready]
      return { deployment: ready }
    },
  }
  const props: any = { projectId: 'p1', running: false, blockedReason: options.blocked, terminal: [], events: [],
    onPrepare: async () => { prepared++; if (options.rejectPreparation) throw new Error('Lost acknowledgement') } }
  const react = { ...React,
    useState(initial: any) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value: any) => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true } }]
    },
    useCallback(callback: unknown) { cursor++; return callback },
    useRef(current: any) { const index = cursor++; return slots[index] ??= { current } },
    useEffect(effect: () => (() => void) | void, deps: unknown[]) {
      const index = cursor++; const old = slots[index]
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
    },
  }
  const module = { exports: {} as { PublishPopover: (props: any) => any } }
  const isolatedRequire = (id: string): any => {
    if (id === 'react') return react
    if (id === '@/hooks/use-integration-connect') return { useIntegrationConnect: () => ({ connecting: null, connect: async () => {} }) }
    if (id === 'next/link') return { __esModule: true, default: (p: any) => React.createElement('a', p) }
    if (id === '@/lib/backend/browser') return { currentBackend: () => backend }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id === './session-types' ? '../components/computer/session-types' : id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  const render = () => { cursor = 0; dirty = false; tree = module.exports.PublishPopover(props); effects.splice(0).forEach(effect => effect()) }
  render()
  return {
    prepared: () => prepared, approvals,
    toggle(open: boolean) { tree.props.onOpenChange(open) },
    async flush() { for (let i = 0; i < 8; i++) { await setImmediate(); if (dirty) render() } },
    html: () => renderToStaticMarkup(tree.props.content),
    update(next: Record<string, unknown>) { Object.assign(props, next); render() },
    approve() {
      const find = (node: any): any => Array.isArray(node) ? node.map(find).find(Boolean) : node && typeof node === 'object'
        ? node.props?.record?.id === 'd1' ? node : find(node.props?.children) : undefined
      const card = find(tree.props.content); assert.ok(card); card.props.onSubmit('approve')
    },
    close() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}

test('Publish starts preparation once on opening; closing and reopening never repeats an accepted request', async () => {
  const panel = mount()
  assert.equal(panel.prepared(), 0)
  panel.toggle(true)
  await panel.flush()
  assert.equal(panel.prepared(), 1)
  assert.match(panel.html(), /request was accepted/)
  panel.toggle(false); await panel.flush()
  panel.toggle(true); await panel.flush()
  assert.equal(panel.prepared(), 1)
  panel.close()
})

test('pending review opens without new AI work and publication requires an explicit hash-bound approval', async () => {
  const panel = mount({ records: [review] })
  panel.toggle(true); await panel.flush()
  assert.equal(panel.prepared(), 0)
  assert.match(panel.html(), /Approve and publish/)
  assert.equal(panel.approvals.length, 0)
  assert.doesNotMatch(panel.html(), /Open this deployment/)
  panel.approve(); await panel.flush()
  assert.deepEqual(panel.approvals, [['p1', 'd1', review.sha256]])
  assert.match(panel.html(), /Open this deployment/)
  panel.close()
})

test('unavailable access and pending workspace work never dispatch preparation', async () => {
  for (const options of [{ available: false }, { blocked: 'Answer the pending question first.' }]) {
    const panel = mount(options)
    panel.toggle(true); await panel.flush()
    assert.equal(panel.prepared(), 0)
    assert.match(panel.html(), /role="alert"/)
    panel.close()
  }
})

test('uncertain preparation is retained without retries, and real terminal text is redacted', async () => {
  const panel = mount({ rejectPreparation: true })
  panel.toggle(true); await panel.flush()
  assert.match(panel.html(), /Retry original message/)
  panel.toggle(false); await panel.flush()
  panel.toggle(true); await panel.flush()
  assert.equal(panel.prepared(), 1)
  panel.update({ terminal: [{ id: 'new', command: 'npm run build', status: 'done', at: '2026-11-16T00:00:00Z', output: 'Authorization: Bearer sensitive-value', exitCode: 0 }] })
  assert.match(panel.html(), /npm run build/)
  assert.doesNotMatch(panel.html(), /sensitive-value/)
  panel.close()
})
