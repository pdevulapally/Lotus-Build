import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'
import { BrandLogo } from '../components/integrations/connector-icons'
import { connectorLogoPath, integrationRows } from '../lib/integrations/directory'
import type { Connector, Connection } from '../lib/backend/connections'
import ts from 'typescript'

const connectors: Connector[] = [
  { key: 'netlify', name: 'Netlify', summary: 'Publish your site', auth: 'netlify-oauth', browserCallback: true, status: 'available', capabilities: [] },
  { key: 'github', name: 'GitHub', summary: 'Work with repositories', auth: 'github-app', status: 'available', capabilities: [] },
  { key: 'mcp', name: 'Custom server', summary: 'Custom tools', auth: 'mcp-remote', status: 'available', capabilities: [] },
]
const connection: Connection = { id: 'c1', connector: 'netlify', status: 'active', scopes: [],
  account: { id: 'a1', name: 'My team' }, createdAt: '2026-11-16T00:00:00Z', updatedAt: '2026-11-16T00:00:00Z' }

test('known brands use the shipped SVG even when an older catalogue omits iconPath', () => {
  for (const key of ['github', 'netlify', 'vercel', 'slack', 'aws', 'mcp']) {
    const path = connectorLogoPath(key)
    assert.ok(path)
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)))
    assert.match(readFileSync(new URL(`../public${path}`, import.meta.url), 'utf8'), /<svg/)
    const html = renderToStaticMarkup(createElement(BrandLogo, { connector: key, name: key }))
    assert.ok(html.includes(`src="${path}"`))
  }
  assert.equal(connectorLogoPath('netlify', '/integrations/github.svg'), '/integrations/github.svg', 'Explicit catalogue presentation wins')
  assert.equal(connectorLogoPath('unknown'), undefined)
  assert.equal(connectorLogoPath('constructor'), undefined)
})

test('directory shows each connection once, supports real search and retains multiple accounts', () => {
  const all = integrationRows(connectors, [connection], 'available', '')
  assert.deepEqual(all.map(row => row.connector.key), ['netlify', 'github', 'mcp'])
  assert.equal(all[0].connection?.id, 'c1')
  assert.equal(integrationRows(connectors, [connection], 'available', ' MY TEAM ').length, 1)
  assert.equal(integrationRows(connectors, [connection], 'available', 'repositories')[0].connector.key, 'github')
  assert.equal(integrationRows(connectors, [connection], 'available', 'no match').length, 0)
  assert.equal(integrationRows(connectors, [connection], 'connected', '').length, 1)
  assert.equal(integrationRows(connectors, [connection, { ...connection, id: 'c2' }], 'connected', '').length, 2)
  assert.equal(integrationRows(connectors, [{ ...connection, status: 'revoked' }], 'connected', '').length, 0)
  assert.equal(integrationRows(connectors, [{ ...connection, connector: 'mcp' }], 'connected', '')[0].connector.key, 'mcp')
})

function directoryFixture(catalogue = connectors, options: { failure?: boolean; connectionsFailed?: boolean; origin?: string } = {}) {
  const require = createRequire(import.meta.url)
  const source = readFileSync(new URL('../app/integrations/page.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(`${source}\nexports.TestContent = IntegrationsContent`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const react = require('react')
  let stateIndex = 0
  const states: unknown[] = []
  const calls: string[] = []; const redirects: string[] = []; const inputs: unknown[] = []
  let tree: any
  const module = { exports: {} as { TestContent: () => any } }
  const isolatedRequire = (id: string) => {
    if (id === 'react') return { ...react, useEffect: () => {}, useState: (initial: unknown) => {
      const index = stateIndex++
      if (!(index in states)) states[index] = index === 0 ? options.failure ? { kind: 'error', message: 'Raw diagnostic' }
        : { kind: 'ready', connectors: catalogue, connections: [connection], configured: !options.connectionsFailed } : typeof initial === 'function' ? initial() : initial
      return [states[index], (value: unknown) => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    } }
    if (id === 'next/navigation') return { useSearchParams: () => new URLSearchParams() }
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ user: { uid: 'u' } }) }
    if (id === '@/components/settings/settings-dialog') return { useSettingsDialog: () => ({ openSettings: () => assert.fail('Render must not change settings') }) }
    if (id === '@/lib/backend/browser') return { currentBackend: () => ({ startConnection: async (key: string, input: unknown) => { calls.push(key); inputs.push(input); return { authorizeUrl: 'https://provider.test/authorize' } } }) }
    if (id === '@/components/ui/dialog') return {
      Dialog: ({ open, children }: any) => open ? children : null,
      DialogContent: ({ children }: any) => createElement('section', { role: 'dialog' }, children),
      DialogTitle: ({ children }: any) => createElement('h2', null, children),
      DialogDescription: ({ children }: any) => createElement('p', null, children),
    }
    if (id === '@/components/settings/plugins-panel') return { PluginsPanel: () => { assert.fail('Access controls stay closed until requested') } }
    if (id === '@/components/ui/navbar' || id === '@/components/auth/protected-route') return {}
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => key }) }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  const window = { location: { origin: options.origin ?? 'https://app.test', assign: (url: string) => redirects.push(url) } }
  new Function('require', 'module', 'exports', 'window', compiled)(isolatedRequire, module, module.exports, window)
  const render = () => { stateIndex = 0; tree = module.exports.TestContent(); return renderToStaticMarkup(tree) }
  return { calls, redirects, inputs, render, click(match: { aria?: string; text?: string }) {
    const find = (node: any): any => Array.isArray(node) ? node.map(find).find(Boolean) : node && typeof node === 'object'
      ? ((match.aria ? node.props?.['aria-label'] === match.aria : node.props?.children === match.text) && node.props?.onClick ? node : find(node.props?.children)) : undefined
    const element = find(tree); assert.ok(element); element.props.onClick()
  } }
}

test('rendered directory has reference header controls and shipped logos without expanded permission panels', () => {
  const fixture = directoryFixture()
  const html = fixture.render()
  assert.match(html, /aria-label="Search integrations"/)
  assert.match(html, /aria-label="Integration settings"/)
  assert.match(html, />Add /)
  assert.match(html, /aria-pressed="true"[^>]*>Available/)
  assert.match(html, /src="\/integrations\/netlify.svg"/)
  assert.match(html, /src="\/integrations\/github.svg"/)
  assert.match(html, /aria-label="Options for Netlify \(My team\)"/)
  assert.match(html, /aria-label="Connect GitHub"/)
  assert.doesNotMatch(html, /Custom MCP servers|Manage.*c1/)
  assert.equal(fixture.calls.length, 0)
})

test('missing catalogue is an explicit setup problem, and custom-only catalogues remain browsable', () => {
  const empty = directoryFixture([]).render()
  assert.match(empty, /Integrations haven’t been set up yet/)
  assert.match(empty, /Refresh integrations/)
  assert.doesNotMatch(empty, /No integrations are available right now|Connect GitHub/)
  const custom = directoryFixture([connectors[2]]).render()
  assert.match(custom, /Custom server/)
  assert.match(custom, /aria-label="Connect Custom server"/)
})

test('browsing opens service details, and only explicit Connect starts authorization', async () => {
  const fixture = directoryFixture()
  fixture.render()
  fixture.click({ aria: 'Connect GitHub' })
  const details = fixture.render()
  assert.match(details, /role="dialog"/)
  assert.match(details, /After connecting, choose which projects and tools/)
  assert.equal(fixture.calls.length, 0)
  fixture.click({ text: 'Connect GitHub' })
  await setImmediate()
  assert.deepEqual(fixture.calls, ['github'])
  assert.deepEqual(fixture.redirects, ['https://provider.test/authorize'])
})

test('request failures and unavailable connection history are not presented as an empty catalogue', () => {
  const failed = directoryFixture([], { failure: true }).render()
  assert.match(failed, /Integrations couldn’t be loaded/)
  assert.match(failed, /Refresh integrations/)
  assert.doesNotMatch(failed, /haven’t been set up|Raw diagnostic|Connect GitHub/)
  const historyFailed = directoryFixture(connectors, { connectionsFailed: true }).render()
  assert.match(historyFailed, /Your connections couldn’t be loaded/)
  assert.match(historyFailed, /Refresh connections/)
  assert.doesNotMatch(historyFailed, /haven’t been set up/)
  const empty = directoryFixture([])
  empty.render()
  assert.equal(empty.calls.length, 0, 'No invented providers or authorization requests')
})

test('Netlify uses the current frontend origin unchanged; no localhost callback substitution', async () => {
  for (const origin of ['http://localhost:3000', 'https://www.lotusbuild.co.uk']) {
    const fixture = directoryFixture(connectors, { origin })
    fixture.render()
    // The name opens the same service review even when an account is connected.
    fixture.click({ text: 'Netlify' })
    fixture.render()
    fixture.click({ text: 'Connect Netlify' })
    await setImmediate()
    assert.deepEqual(fixture.inputs, [{ returnTo: `${origin}/integrations/netlify/setup`, projectIds: [] }])
  }
})
