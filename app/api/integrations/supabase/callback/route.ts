import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { exchangeCode, storeConnection } from "@/lib/integrations/supabase/oauth"
import { getAppBaseUrl } from "@/lib/security/url"

export const runtime = "nodejs"
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

function serializeInlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function isFreshState(createdAt: unknown): boolean {
  const date = createdAt && typeof createdAt === "object" && "toDate" in createdAt && typeof (createdAt as { toDate: () => Date }).toDate === "function"
    ? (createdAt as { toDate: () => Date }).toDate()
    : createdAt instanceof Date
      ? createdAt
      : typeof createdAt === "string" || typeof createdAt === "number"
        ? new Date(createdAt)
        : null
  return !!date && !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= OAUTH_STATE_TTL_MS
}

function callbackHtml(
  ok: boolean,
  message: string,
  targetOrigin: string,
  nonce: string,
  builderProjectId?: string,
) {
  const payload = serializeInlineScriptJson({
    type: "supabase-oauth",
    ok,
    message,
    builderProjectId: builderProjectId || null,
  })
  const serializedTargetOrigin = serializeInlineScriptJson(targetOrigin)

  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script nonce="${nonce}">
(function () {
  var payload = ${payload};
  try {
    var stored = JSON.stringify(payload);
    localStorage.setItem("supabase-oauth-result", stored);
  } catch(e) {
  }
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, ${serializedTargetOrigin});
    }
  } catch(e) {
  }
  setTimeout(function() { window.close(); }, 800);
})();
</script><p>${ok ? "Supabase connected. You can close this window." : "Supabase connection failed. You can close this window."}</p></body></html>`
}

function callbackResponse(
  ok: boolean,
  message: string,
  targetOrigin: string,
  builderProjectId?: string,
) {
  const nonce = randomBytes(18).toString("base64url")
  return new NextResponse(callbackHtml(ok, message, targetOrigin, nonce, builderProjectId), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const targetOrigin = new URL(getAppBaseUrl(url.origin)).origin
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return callbackResponse(false, "Supabase authorization was not completed.", targetOrigin)
  }
  if (!code || !state) {
    return new NextResponse("Missing code or state", { status: 400 })
  }

  const stateSnap = await adminDb.collection("supabaseOauthStates").doc(state).get()
  if (!stateSnap.exists) {
    return new NextResponse("Invalid or expired state", { status: 400 })
  }

  const stateData = stateSnap.data() ?? {}
  if (!isFreshState(stateData.createdAt)) {
    await adminDb.collection("supabaseOauthStates").doc(state).delete().catch(() => {})
    return new NextResponse("Invalid or expired state", { status: 400 })
  }

  const { uid, builderProjectId } = stateData as { uid?: string; builderProjectId?: string }
  if (!uid) {
    return new NextResponse("Invalid state payload", { status: 400 })
  }

  try {
    const token = await exchangeCode(code)
    await storeConnection(uid, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    })
    await adminDb.collection("supabaseOauthStates").doc(state).delete().catch(() => {})
    return callbackResponse(true, "connected", targetOrigin, builderProjectId)
  } catch {
    return callbackResponse(false, "Supabase connection failed.", targetOrigin, builderProjectId)
  }
}

