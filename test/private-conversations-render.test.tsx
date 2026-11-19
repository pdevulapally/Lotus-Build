import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { PrivateConversations } from '../components/project/private-conversations'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../components/project/private-conversations.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX},
}).outputText

function render(user: {uid:string} | null, current: {uid:string} | null, visible = true) {
  const module = {exports:{} as {PrivateConversations:typeof PrivateConversations}}
  let bound = false
  const load = (id:string) => {
    if (id === 'react') return {...require(id), useSyncExternalStore:() => visible}
    if (id === '@/contexts/auth-context') return {useAuth:() => ({user})}
    if (id === '@/lib/firebase') return {auth:{currentUser:current}}
    if (id === '@/lib/backend/browser') return {currentBackend:() => { bound = true; return {} }}
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  new Function('require','module','exports',compiled)(load,module,module.exports)
  return {html:renderToStaticMarkup(createElement(module.exports.PrivateConversations)), bound}
}

test('render: account transition and sign-out do not mount a private view', () => {
  const alice = {uid:'alice'}, bob = {uid:'bob'}
  for (const identity of [bob,null]) {
    const view = render(alice,identity)
    assert.equal(view.bound,false)
    assert.doesNotMatch(view.html,/Project name|Your projects|Your message/)
  }
  assert.match(render(null,null).html,/Sign in to open your projects/)
  assert.doesNotMatch(render(bob,bob,false).html,/Project name|Your projects/)
  assert.match(render(bob,bob).html,/Open a project/)
})
