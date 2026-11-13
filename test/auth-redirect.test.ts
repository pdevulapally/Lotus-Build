import assert from 'node:assert/strict'
import test from 'node:test'
import { getSafeRedirectPath } from '../lib/auth/redirect'

test('stale task-preview sign-in destinations return to the original home', () => {
  for (const path of ['/tasks', '/tasks?view=code', '/tasks/old-id', '/tasks#draft']) {
    assert.equal(getSafeRedirectPath(path), '/')
  }
})

test('original project and computer destinations remain intact', () => {
  for (const path of ['/', '/project/project-id', '/computer/session-id?tab=preview']) {
    assert.equal(getSafeRedirectPath(path), path)
  }
})

test('untrusted and recursive sign-in destinations still fall back safely', () => {
  for (const path of [null, '', 'https://example.test', '//example.test', '/\\example.test', '/login', '/signup?redirect=/']) {
    assert.equal(getSafeRedirectPath(path), '/')
  }
})

test('credit purchase reference survives the same-origin billing login return', () => {
  const path = `/account/billing?credit_purchase_id=${'a'.repeat(64)}`
  assert.equal(getSafeRedirectPath(path), path)
})
