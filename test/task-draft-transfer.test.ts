import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { claimTaskDraft, clearCreatedTaskDraft, clearTaskDraft, DRAFT_TTL_MS, readTaskDraft, saveTaskDraft, taskDraftKey } from '../lib/tasks/draft-transfer'
function storage() { const data = new Map<string,string>(); return { getItem:(key:string)=>data.get(key)??null, setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)} } }

test('landing draft survives reload without becoming an execution request', () => {
  const s=storage(); saveTaskDraft(s,null,'Build a shop','code',false,100)
  assert.equal(readTaskDraft(s,null,101)?.text,'Build a shop')
  assert.equal(claimTaskDraft(s,'alice',102),null)
  assert.equal(readTaskDraft(s,null,103)?.readyForTransfer,false)
})
test('explicit guest continuation claims draft once to chosen account and persists for review', () => {
  const s=storage(); saveTaskDraft(s,null,'Private goal','code',true,100)
  assert.equal(claimTaskDraft(s,'alice',101)?.text,'Private goal')
  assert.equal(readTaskDraft(s,null,102),null)
  assert.equal(claimTaskDraft(s,'bob',102),null)
  assert.equal(claimTaskDraft(s,'alice',103)?.ownerUid,'alice')
  clearTaskDraft(s,'alice'); assert.equal(claimTaskDraft(s,'alice',104),null)
})
test('signed-in drafts cannot be restored or consumed by another account', () => {
  const s=storage(); saveTaskDraft(s,'alice','Alice private task','desktop',true,100)
  saveTaskDraft(s,'bob','Bob private task','code',true,100)
  assert.equal(claimTaskDraft(s,'bob',101)?.text,'Bob private task')
  assert.equal(claimTaskDraft(s,'alice',101)?.kind,'desktop')
  clearTaskDraft(s,'bob'); assert.equal(readTaskDraft(s,'alice',102)?.text,'Alice private task')
})
test('draft expiry, corrupt owner, malformed JSON and oversized input fail closed', () => {
  const s=storage(); saveTaskDraft(s,null,'Old draft','code',true,100)
  assert.equal(claimTaskDraft(s,'alice',101+DRAFT_TTL_MS),null)
  s.setItem(taskDraftKey('bob'),JSON.stringify({version:1,ownerUid:'alice',text:'secret',kind:'code',updatedAt:100,readyForTransfer:true}))
  assert.equal(readTaskDraft(s,'bob',101),null)
  s.setItem(taskDraftKey(null),'{broken'); assert.equal(readTaskDraft(s,null,101),null)
  assert.throws(()=>saveTaskDraft(s,null,'x'.repeat(32001)))
  assert.throws(()=>saveTaskDraft(s,null,'   '))
})
test('storage failure does not erase guest draft before successful ownership transfer', () => {
  const s=storage(); saveTaskDraft(s,null,'Keep my draft','code',true,100)
  const blocked={...s,setItem:()=>{throw new Error('blocked')}}
  assert.throws(()=>claimTaskDraft(blocked,'alice',101),/blocked/)
  assert.equal(readTaskDraft(s,null,102)?.text,'Keep my draft')
})
test('hero is a real multiline composer, carries no prompt URL and cannot call task APIs', () => {
  const source=readFileSync('components/landing/task-entry.tsx','utf8')
  assert.match(source,/<Textarea id="project-brief"/)
  assert.match(source,/maxLength=\{32000\}/)
  assert.match(source,/<form onSubmit=\{submit\}/)
  assert.match(source,/saveTaskDraft\(sessionStorage, uid, text\.trim\(\), 'code', true\)/)
  assert.match(source,/router\.push\(user \? '\/tasks' : '\/login\?redirect=%2Ftasks'\)/)
  assert.doesNotMatch(source,/TaskClient|currentTaskBackend|fetch\(|\.create\(|localStorage/)
  assert.match(source,/draft\.owner !== uid/)
  assert.match(source,/promptRequestId/)
  const workspace=readFileSync('components/tasks/task-workspace.tsx','utf8')
  assert.ok(workspace.indexOf('readPendingCommand') < workspace.indexOf('const incoming = claimTaskDraft'))
  assert.match(workspace,/if \(!pending\) \{/)
  assert.match(workspace,/Nothing has run yet/)
  assert.match(workspace,/Start task/)
})

test('resolved create clears only its matching transferred draft, including replay path', () => {
  const s=storage(); saveTaskDraft(s,'alice','  Build my task  ','code',true)
  clearCreatedTaskDraft(s,'alice','Build my task','code'); assert.equal(readTaskDraft(s,'alice'),null)
  saveTaskDraft(s,'alice','A different later draft','code',true)
  clearCreatedTaskDraft(s,'alice','Build my task','code'); assert.equal(readTaskDraft(s,'alice')?.text,'A different later draft')
  const hook=readFileSync('hooks/use-task-workspace.ts','utf8')
  assert.match(hook,/clearCreatedTaskDraft\(sessionStorage, uid, command\[1\], command\[2\]\)/)
})
