import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { applyEvents, type Conversation } from '../lib/backend/conversation'
import { PrivateQueries, operationIdentity } from '../lib/backend/private-queries'

const project = 'a'.repeat(32)
const session = 'b'.repeat(32)
const page = {projects: [{id: project, name: 'Example'}], next_cursor: null}
const snapshot: Conversation = {session, status: 'queued', cursor: 1, events: [{sequence: 1, kind: 'question', text: 'Example?'}]}
const storage = () => {
  const map = new Map<string, string>()
  return {getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k,v) }, removeItem: (k: string) => { map.delete(k) }}
}

test('private list: simultaneous components share one request, then reuse the warm page', async () => {
  let bytes = 0
  const client = new BackendClient({origin:'https://api.example',token: async () => 'test',fetch: async url => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/projects')
    bytes += Buffer.byteLength(JSON.stringify(page))
    return Response.json(page)
  }})
  // An inactive view issues no request; neither list readers nor a remount start a task.
  assert.equal(client.queries.metrics.requests, 0)
  const results = await Promise.all([client.privateProjects(null),client.privateProjects(null)])
  assert.deepEqual(results,[page,page]); assert.deepEqual(await client.privateProjects(null), page)
  assert.deepEqual(client.queries.metrics, {requests:1, hits:1, misses:1, coalesced:1, retries:0})
  assert.equal(bytes, Buffer.byteLength(JSON.stringify(page)))
})

test('private page data: measure uncached, cold and warm fixture reads', async () => {
  const plan = {key:'demo',name:'Demo'}
  const fixture: Record<string, unknown> = {
    '/me': {uid:'alice',email:'test@example.invalid',emailVerified:true,projectCount:1,plan,limits:[],models:[],capabilities:[]},
    '/me/usage': {uid:'alice',plan,meters:[]}, '/api/v1/projects': page,
  }
  let calls = 0, bytes = 0
  const client = new BackendClient({origin:'https://api.example',owner:'alice',token:async () => 'test',fetch:async url => {
    const body = JSON.stringify(fixture[new URL(String(url)).pathname])
    calls++; bytes += Buffer.byteLength(body); return new Response(body)
  }})
  const measure = () => { const m = {calls,bytes}; calls = 0; bytes = 0; return m }
  // Same inputs: load the verified-account gate, then two identical list readers.
  await client.me(); await client.usage()
  await client.privateProjects(null); client.queries.invalidate(); await client.privateProjects(null)
  const baseline = measure()
  client.queries.invalidate()
  async function load() {
    await Promise.all([client.me(),client.usage()])
    await Promise.all([client.privateProjects(null),client.privateProjects(null)])
    return measure()
  }
  const cold = await load(), warm = await load()
  assert.deepEqual([baseline.calls,cold.calls,warm.calls], [4,3,2])
  assert.equal(baseline.bytes-cold.bytes, Buffer.byteLength(JSON.stringify(page)))
  console.info('Fixture page body transfer:', {baseline,cold,warm})
})

test('TTL, invalidation, bounded retries and permanent denials', async () => {
  let clock = 0, calls = 0
  const waits: number[] = []
  const cache = new PrivateQueries(() => clock, async ms => { waits.push(ms) })
  const read = (key: string) => cache.read(key, 10, undefined, async () => ++calls)
  assert.equal(await read('list'),1); assert.equal(await read('list'),1)
  clock = 10; assert.equal(await read('list'),2); assert.equal(await read('detail'),3)
  cache.invalidate('list'); assert.equal(await read('detail'),3); assert.equal(await read('list'),4)
  await assert.rejects(cache.read('x',0,undefined,async () => {throw new TypeError('network')}))
  assert.equal(waits.length,2); assert.ok(waits[0]<waits[1])
  await assert.rejects(cache.read('y',0,undefined,async () => {throw Object.assign(new Error(),{status:403})}))
  assert.equal(waits.length,2)
})

test('one reader can cancel; account disposal fences a transport that ignores abort', async () => {
  let deliver!: (s: string) => void
  const alice = new PrivateQueries(), bob = new PrivateQueries()
  const abort = new AbortController()
  const load = () => new Promise<string>(resolve => { deliver = resolve })
  const a = alice.read('project',1000,abort.signal,load)
  const b = alice.read('project',1000,undefined,load)
  await Promise.resolve()
  abort.abort()
  await assert.rejects(a,{name:'AbortError'})
  alice.close()
  assert.equal(await bob.read('project',1000,undefined,async () => 'Bob'),'Bob')
  deliver('Alice')
  await assert.rejects(b,{name:'AbortError'})
  await assert.rejects(alice.read('project',1000,undefined,load),{name:'AbortError'})
})

test('operation identity survives remount, separates changed payloads and accounts, clears on success', async () => {
  const store = storage(), scope = ['https://api.example','alice','personal','create','']
  const [one, two] = await Promise.all([operationIdentity(store,scope,['Name']),operationIdentity(store,scope,['Name'])])
  assert.equal(one.id,two.id)
  assert.notEqual((await operationIdentity(store,scope,['Other'])).id,one.id)
  assert.notEqual((await operationIdentity(store,[...scope,'different'],['Name'])).id,one.id)
  one.confirmed()
  assert.notEqual((await operationIdentity(store,scope,['Name'])).id,one.id)
})

test('lost acknowledgement keeps the same project identity; confirmation invalidates cached lists', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage')
  Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true})
  try {
    let reads = 0
    const writes: string[] = []
    const client = new BackendClient({origin:'https://api.example',owner:'alice',token:async () => 'test',fetch:async (_,init) => {
      if (init?.method==='GET') { reads++; return Response.json(page) }
      writes.push(String(init?.body))
      if (writes.length === 1) throw new TypeError('lost acknowledgement')
      return Response.json(page.projects[0])
    }})
    await client.privateProjects(null)
    await assert.rejects(client.createPrivateProject('Example'))
    assert.equal(writes.length,1)
    await client.createPrivateProject('Example')
    assert.equal(writes[0],writes[1])
    await client.privateProjects(null); assert.equal(reads,2)
  } finally {
    if (descriptor) Object.defineProperty(globalThis,'sessionStorage',descriptor)
    else Reflect.deleteProperty(globalThis,'sessionStorage')
  }
})

test('reconnect merges ordered events, ignores replay and rejects gaps', () => {
  const delta: Conversation = {session,status:'completed',cursor:2,events:[{sequence:2,kind:'answer',text:'Yes'}]}
  const before = applyEvents(null,snapshot)
  const after = applyEvents(before,delta)
  assert.equal(after.events.length,2)
  assert.deepEqual(applyEvents(after,delta),after)
  assert.deepEqual(applyEvents(after,snapshot),after)
  assert.throws(() => applyEvents(null,delta))
})

test('an accepted terminal snapshot does not start another poll or refetch history', async () => {
  const client = new BackendClient({origin:'https://api.example',token:async () => 'test',fetch:async () => assert.fail('unexpected request')})
  const controller = new AbortController()
  const stream = client.followConversation(project, controller.signal, {...snapshot,status:'stopped'})
  assert.equal((await stream.next()).value?.status,'stopped')
  assert.equal((await stream.next()).done,true)
})

test('Python mutation contract: lost submission retries its session, clarification targets its cursor and Stop its run', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage')
  Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true})
  const calls: {path:string;method:string;body:unknown}[] = []
  try {
    const client = new BackendClient({origin:'https://api.example',owner:'alice',token:async () => 'fixture',fetch:async (url,init) => {
      const {pathname, search} = new URL(String(url))
      calls.push({path:pathname+search,method:init!.method!,body:init?.body && JSON.parse(String(init.body))})
      if (calls.length === 1) throw new TypeError('lost acknowledgement')
      return Response.json({...snapshot,session:pathname.split('/')[6].replaceAll('-','')})
    }})
    await assert.rejects(client.ask(project,' Example? '))
    const task = await client.ask(project,'Example?')
    assert.deepEqual(calls[0],calls[1])
    assert.equal(calls[1].method,'PUT')
    assert.deepEqual(calls[1].body,{question:'Example?'})
    assert.match(calls[1].path,new RegExp(`^/api/v1/projects/${project}/sessions/[a-f0-9-]{36}/run\\?mode=conversation$`))
    await client.steerConversation(project,task.session,'Threads',2)
    const target = `/api/v1/projects/${project}/sessions/${task.session}/run`
    assert.match(calls[2].path,new RegExp(`^${target}/messages/[a-f0-9-]{36}\\?reply_to=2$`))
    assert.deepEqual(calls[2].body,{question:'Threads'})
    await client.stopConversation(project,task.session)
    assert.deepEqual(calls[3],{path:`${target}/stop`,method:'PUT',body:undefined})
  } finally {
    if (previous) Object.defineProperty(globalThis,'sessionStorage',previous)
    else Reflect.deleteProperty(globalThis,'sessionStorage')
  }
})
