import assert from 'node:assert/strict'
import test from 'node:test'
import { getSafeRedirectPath } from '../lib/auth/redirect'

test('stale task-preview sign-in destinations return to the original home', () => {
  for (const path of ['/tasks', '/tasks?view=code', '/tasks/old-id', '/tasks#draft']) {
    assert.equal(getSafeRedirectPath(path), '/')
  }
})

test('original project and computer destinations remain intact', () => {
  for (const path of ['/', '/project/project-id', '/computer/session-id?tab=preview', '/invitations/accept?organisation=org-1&token=' + 'a'.repeat(43)]) {
    assert.equal(getSafeRedirectPath(path), path)
  }
})

test('untrusted and recursive sign-in destinations still fall back safely', () => {
  for (const path of [null, '', 'https://example.test', '//example.test', '/\\example.test', '/login', '/signup?redirect=/']) {
    assert.equal(getSafeRedirectPath(path), '/')
  }
})
