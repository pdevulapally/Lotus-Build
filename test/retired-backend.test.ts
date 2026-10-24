import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = join(dir, entry.name)
    return entry.isDirectory() ? sourceFiles(name) : /\.(ts|tsx|js|jsx)$/.test(name) ? [name] : []
  })
}

test('application source has no legacy API factory, origin or email-code endpoints', () => {
  for (const file of ['app', 'components', 'contexts', 'hooks', 'lib'].flatMap(sourceFiles)) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /\bcurrentBackend\b|\bBackendClient\b|NEXT_PUBLIC_BACKEND_URL|\/auth\/email-verification\b|\/me\/usage\b/, file)
  }
})

test('shared authentication uses Firebase identity, never a legacy account bootstrap', () => {
  const source = readFileSync('contexts/auth-context.tsx', 'utf8')
  assert.match(source, /onAuthStateChanged/)
  assert.match(source, /firebase\/auth/)
  assert.match(source, /signInWithEmailAndPassword/)
  assert.match(source, /createUserWithEmailAndPassword/)
  assert.match(source, /sendPasswordResetEmail/)
  assert.doesNotMatch(source, /BackendAccount|BackendUsage|\.me\(|\.usage\(|fetch\(/)
})

test('new workspace browser factory captures and rechecks the signed-in identity', () => {
  const source = readFileSync('lib/backend/browser.ts', 'utf8')
  assert.match(source, /const identity = auth\.currentUser/)
  assert.ok((source.match(/auth\.currentUser\?\.uid !== identity\.uid/g) ?? []).length >= 2)
  assert.match(source, /await identity\.getIdToken\(/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.log/)
})

test('email verification uses Firebase links and refreshes identity after verification', () => {
  const source = readFileSync('app/verify-email/page.tsx', 'utf8')
  assert.match(source, /from ['"]firebase\/auth['"]/)
  assert.match(source, /await sendEmailVerification\(identity\)/)
  assert.match(source, /await reload\(identity\)/)
  assert.match(source, /identity\.emailVerified/)
  assert.match(source, /await identity\.getIdToken\(true\)/)
  assert.doesNotMatch(source, /fetch\(|EmailCodeVerification|currentBackend|verification-code/)
  const gate = readFileSync('components/auth/verified-email-gate.tsx', 'utf8')
  assert.match(gate, /user\?\.emailVerified/)
  assert.match(gate, /getSafeRedirectPath/)
})

test('old project and computer bookmarks do not silently become new task IDs', () => {
  for (const route of ['app/project/[id]/page.tsx', 'app/computer/[id]/page.tsx']) {
    const source = readFileSync(route, 'utf8')
    assert.match(source, /RetiredWorkspace/)
    assert.doesNotMatch(source, /fetch\(|redirect\(|router\.|params/)
  }
  const notice = readFileSync('components/tasks/retired-workspace.tsx', 'utf8')
  assert.match(notice, /not.*migrat|not.*transfer|not.*copied/i)
  assert.doesNotMatch(notice, /fetch\(|\.delete\(|removeItem\(/)
})

test('pricing makes no checkout calls or subscription-state claims', () => {
  const source = readFileSync('app/pricing/page.tsx', 'utf8')
  assert.match(source, /Billing is not connected yet/)
  assert.match(source, /Existing subscriptions are not cancelled/)
  assert.doesNotMatch(source, /fetch\(|\.checkout\(|\.billingPortal\(|window\.location|stripe\.com/)
  assert.doesNotMatch(readFileSync('.env.example', 'utf8'), /NEXT_PUBLIC_BACKEND_URL/)
})

test('stale workspace callers cannot capture the newly signed-in account', () => {
  const source = readFileSync('lib/backend/browser.ts', 'utf8')
  assert.match(source, /currentTaskBackend\(expectedUid: string\)/)
  assert.match(source, /identity\??\.uid !== expectedUid/)
  const hook = readFileSync('hooks/use-task-workspace.ts', 'utf8')
  assert.doesNotMatch(hook, /currentTaskBackend\(\)/)
  assert.match(hook, /currentTaskBackend\(uid\)/)
})

test('polling source guards in-flight mutations and invalidates older success and error responses', () => {
  const source = readFileSync('hooks/use-task-workspace.ts', 'utf8')
  const poll = source.slice(source.indexOf('async function poll()'), source.indexOf('void poll()'))
  assert.ok(poll.indexOf('if (busyRef.current)') < poll.indexOf('await currentTaskBackend(uid).read'))
  assert.match(poll, /if \(busyRef\.current\) \{ timer = setTimeout\(poll, 1500\); return \}/)
  assert.match(poll, /const epoch = pollEpoch\.current/)
  assert.equal((poll.match(/if \(epoch !== pollEpoch\.current\)/g) ?? []).length, 2, 'both success and error paths check mutation epoch')
  assert.ok(poll.indexOf('if (epoch !== pollEpoch.current)') < poll.indexOf('accept(next)'))
  assert.match(poll, /\+\+failures < 4/)
  assert.match(poll, /Math\.min\(1500 \* 2 \*\* failures, 12000\)/)
  const mutation = source.slice(source.indexOf('const mutate ='), source.indexOf('const resolvePending ='))
  assert.ok(mutation.indexOf('pollEpoch.current++') < mutation.indexOf('await runTaskCommand'))
  assert.match(source, /abort\.abort\(\); clearTimeout\(timer\)/)
})

test('replay receipts trigger canonical refresh rather than overwriting current state', () => {
  const source = readFileSync('hooks/use-task-workspace.ts', 'utf8')
  const mutation = source.slice(source.indexOf('const mutate ='), source.indexOf('const resolvePending ='))
  assert.match(mutation, /const replaying = !repeatableIntent && !!readPendingCommand/)
  assert.match(mutation, /if \(!replaying\) accept\(next\)/)
  assert.match(mutation, /if \(sessionId !== next\.id\) onCreated\(next\.id\)/)
  assert.match(mutation, /else setRetry\(value => value \+ 1\)/)
  const poll = source.slice(source.indexOf('async function poll()'), source.indexOf('void poll()'))
  assert.match(poll, /accept\(next\)/)
  assert.doesNotMatch(poll, /replaying/)
})
