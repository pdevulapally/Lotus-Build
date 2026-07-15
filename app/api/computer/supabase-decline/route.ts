import { NextResponse } from "next/server"
import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertSessionOwner } from "@/lib/project-access"
import { mapRouteError } from "@/lib/orchestrator/route-utils"

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

    await assertSessionOwner(parsed.data.sessionId, uid)

    await adminDb.collection("computerSessions").doc(parsed.data.sessionId).update({ supabaseAnswer: "no" })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapRouteError(err)
  }
}
