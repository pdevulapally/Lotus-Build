import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as React from 'react'
import ts from 'typescript'
import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepositoryHeader } from '../components/computer/repository-header'
import type { BackendFileTree } from '../lib/backend/client'
import type { SavedProjectFiles } from '../components/computer/saved-project-content'

test('repository Back has only an internal navigation action and never closes the workspace panel', () => {
  let back = 0
  let refresh = 0
  const header = RepositoryHeader({ name: 'owner/repo', repositoryUrl: null, onBackToFiles: () => { back++ }, onRefresh: () => { refresh++ } })
  const visit = (node: ReactNode): void => {
    if (!isValidElement<Record<string, unknown>>(node)) return
    if (node.type === 'button' && node.props['aria-label'] === 'Back to files') (node.props.onClick as () => void)()
    Children.forEach(node.props.children as ReactNode, visit)
  }
  visit(header)
  assert.equal(back, 1)
  assert.equal(refresh, 0)
  const root = renderToStaticMarkup(createElement(RepositoryHeader, { name: 'owner/repo', repositoryUrl: null, onRefresh: () => {} }))
  assert.doesNotMatch(root, /Back to files|Back to workspace|>Workspace</)
  assert.match(root, /Refresh repository/)
})

test('the actual Repository page retains its template when the server returns zero saved files', () => {
  const require = createRequire(import.meta.url)
  const empty: BackendFileTree = { head: null, ref: null, branches: [], files: [], truncated: false }
  let stateIndex = 0
  const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/saved-project-content.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} as { SavedProjectFiles: typeof SavedProjectFiles } }
  const isolatedRequire = (id: string) => {
    if (id === 'react') return { ...React, useState: (initial: unknown) => React.useState(stateIndex++ === 0 ? empty : initial) }
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ account: null }) }
    if (id === '@/lib/backend/browser') return { currentBackend: () => { throw new Error('Rendering must not issue a request.') } }
    if (id === '@monaco-editor/react') return { __esModule: true, default: () => null }
    if (id === '@/components/computer/repository-pull-requests') return { RepositoryPullRequests: () => null }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  const html = renderToStaticMarkup(createElement(module.exports.SavedProjectFiles, { projectId: 'p1' }))
  assert.match(html, /Repository file browser/)
  assert.match(html, />Go to file<|aria-label="Go to file"/)
  assert.match(html, /Last commit message/)
  assert.match(html, /Last commit date/)
  assert.match(html, /No saved files yet/)
  assert.doesNotMatch(html, /No saved files on this branch yet/)
  assert.doesNotMatch(html, /Repository sections|astryx-tab-list|Add file|>Code</)
})

