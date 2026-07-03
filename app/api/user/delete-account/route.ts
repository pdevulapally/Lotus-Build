/**
 * Server-side account deletion.
 *
 * Client-side deletion of users/{uid} is denied by firestore.rules because a
 * delete + bootstrap re-create would mint a fresh free token allocation for
 * the same account. This route deletes the Firebase Auth user FIRST — once
 * the auth user is gone, the uid can never sign in again to re-bootstrap —
 * and then removes the Firestore user document.
 */
import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  let uid: string
  try {
    uid = await requireUserUid(req)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await assertRateLimit({
      scope: "delete-account",
      key: uid,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    // Order matters: auth user first, so a partial failure can never leave a
    // signed-in account without a user doc (which would re-bootstrap a fresh
    // token balance on next load).
    await adminAuth.deleteUser(uid)
    await adminDb.collection("users").doc(uid).delete()
    console.log(`[delete-account] Deleted account ${uid}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`[delete-account] Failed for ${uid}:`, err)
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 }
    )
  }
}
