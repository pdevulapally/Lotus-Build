import assert from "node:assert/strict"
import test from "node:test"
import { requiresVerifiedEmail } from "../lib/auth/verified-email-route"

test("public pages and signed-out visits do not require verified email", () => {
  for (const pathname of ["/", "/help", "/login", "/pricing", "/privacy", "/signup", "/terms", "/verify-email"]) {
    assert.equal(requiresVerifiedEmail(pathname, false), false, pathname)
  }
  for (const pathname of ["/help/article", "/pricing/plan", "/verify-email/step"]) {
    assert.equal(requiresVerifiedEmail(pathname, true), false, pathname)
  }
})

test("signed-in home and private workspaces require verified email", () => {
  assert.equal(requiresVerifiedEmail("/", true), true)
  for (const pathname of ["/computer/s1", "/project/p1", "/settings", "/welcome"]) {
    assert.equal(requiresVerifiedEmail(pathname, true), true, pathname)
  }
  assert.equal(requiresVerifiedEmail("/settings/account", true), true)
})
