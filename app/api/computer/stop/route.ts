import { NextResponse } from "next/server"
import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const stopRequestSchema = z.object({
  sessionId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => null)
    const parsed = stopRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const docRef = adminDb.collection("computerSessions").doc(parsed.data.sessionId)

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef)
      if (!snap.exists) return { status: 403 as const, error: "Access denied" }

      const data = snap.data() as { ownerId?: string; status?: string; timeline?: unknown }
      if (data.ownerId !== uid) return { status: 403 as const, error: "Access denied" }

      // Only an in-progress run can be stopped — otherwise this is a no-op.
      if (data.status !== "running" && data.status !== "planning") {
        return { status: 200 as const, stopped: false }
      }

      const timeline = Array.isArray(data.timeline) ? data.timeline : []
      const stopEvent = {
        id: crypto.randomUUID(),
        title: "Run stopped",
        description: "Stopped by the user.",
        status: "complete",
        kind: "user",
        createdAt: new Date().toISOString(),
        index: timeline.length,
      }

      // Flipping currentRunId is the authoritative cancel signal: the in-flight
      // run bails at its next isActiveRun() checkpoint and stops writing.
      tx.update(docRef, {
        currentRunId: null,
        status: "idle",
        timeline: [...timeline, stopEvent],
        updatedAt: new Date(),
      })

      return { status: 200 as const, stopped: true }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authorization") ? 401 : 500 }
    )
  }
}
