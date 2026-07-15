import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertProjectCanEdit } from "@/lib/project-access"
import { encryptEnvVars } from "@/lib/encrypt-env"
import { mapRouteError } from "@/lib/orchestrator/route-utils"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => ({}))
    const projectId = String(body?.projectId ?? "").trim()
    const token = typeof body?.token === "string" ? body.token.trim() : ""

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const snap = await adminDb.collection("projects").doc(projectId).get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { data } = await assertProjectCanEdit(projectId, uid)
    const ownerId = data.ownerId || data.userId
    if (ownerId !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await adminDb.collection("projects").doc(projectId).update({
      vercelToken: null,
      vercelTokenEncrypted: encryptEnvVars(token).encrypted,
      vercelConnectedAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return mapRouteError(err)
  }
}
