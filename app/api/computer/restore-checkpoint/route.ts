import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { restoreProjectVersion } from "@/lib/project-versions/service"
import { mapRouteError } from "@/lib/orchestrator/route-utils"
import { assertSessionOwner } from "@/lib/project-access"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => ({})) as {
      sessionId?: string
      targetRunId?: string
    }

    const sessionId = String(body.sessionId || "")
    const targetRunId = String(body.targetRunId || "")

    if (!sessionId || !targetRunId) {
      return NextResponse.json({ error: "sessionId and targetRunId are required" }, { status: 400 })
    }

    // Verify session ownership and get projectId
    const { data: sessionData } = await assertSessionOwner(sessionId, uid)
    const projectId = (sessionData as { projectId?: string }).projectId
    if (!projectId) {
      return NextResponse.json({ error: "Session has no associated project" }, { status: 400 })
    }

    // Find the version snapshot for this run
    const versionsSnap = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("versions")
      .where("runId", "==", targetRunId)
      .limit(1)
      .get()

    if (versionsSnap.empty) {
      return NextResponse.json(
        { error: "No snapshot found for this checkpoint. The project may not have been saved at this point." },
        { status: 404 }
      )
    }

    const { restoredVersionId } = await restoreProjectVersion(projectId, versionsSnap.docs[0].id)

    return NextResponse.json({ ok: true, versionId: restoredVersionId })
  } catch (err) {
    return mapRouteError(err)
  }
}
