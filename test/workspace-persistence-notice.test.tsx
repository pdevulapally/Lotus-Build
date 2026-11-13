import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspacePersistenceNotice } from '../components/computer/workspace-persistence-notice'

const render = (capabilities?: Parameters<typeof WorkspacePersistenceNotice>[0]['capabilities']) =>
  renderToStaticMarkup(createElement(WorkspacePersistenceNotice, { capabilities }))

test('a server-disabled persistence capability warns about lost new work without hiding saved files', () => {
  const html = render([{ key: 'git.persistence', kind: 'boolean', value: false }])
  assert.match(html, /role="status"/)
  assert.match(html, /File saving is currently disabled/)
  assert.match(html, /New files and changes won’t be kept after a run ends/)
  assert.match(html, /Previously saved files remain available/)
  assert.doesNotMatch(html, /upgrade|Free|Pro|disabled=/)
})

test('enabled, unloaded, absent and unrelated capabilities do not invent a saving restriction', () => {
  for (const capabilities of [undefined, [], [{ key: 'git.persistence', kind: 'boolean' as const, value: true }],
    [{ key: 'preview.live', kind: 'boolean' as const, value: false }]]) {
    assert.equal(render(capabilities), '')
  }
  assert.equal(render([{ key: 'git.persistence', kind: 'boolean', value: false }]) !== '', true)
  assert.equal(render([{ key: 'git.persistence', kind: 'boolean', value: true }]), '', 'a later refreshed account clears the warning')
})

test('the workspace composer and Files view both use the actual account capability', () => {
  for (const path of ['../app/computer/[id]/page.tsx', '../components/computer/saved-project-content.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<WorkspacePersistenceNotice capabilities=\{account\?\.capabilities\} \/>/)
  }
  const source = readFileSync(new URL('../components/computer/saved-project-content.tsx', import.meta.url), 'utf8')
  assert.match(source, /currentBackend\(\)\.files\(projectId, controller.signal, branch\)/, 'saved branch content remains readable even after an entitlement change')
})
