import { NextResponse } from "next/server"
import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  sessionId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const docRef = adminDb.collection("computerSessions").doc(parsed.data.sessionId)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const data = snap.data() as { ownerId?: string } | undefined
    if (data?.ownerId !== uid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await docRef.update({ supabaseAnswer: "no" })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed"
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authorization") ? 401 : 500 }
    )
  }
}
