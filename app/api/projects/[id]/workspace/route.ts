import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertProjectCanEdit } from "@/lib/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireWorkspaceMember(workspaceId: string, uid: string) {
  const memberDocId = `${workspaceId}_${uid}`
  const snap = await adminDb.collection("workspace_members").doc(memberDocId).get()
  if (!snap.exists) {
    throw new Error("Not a workspace member")
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await requireUserUid(req)
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : ""
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 })
    }

    const projectRef = adminDb.collection("projects").doc(projectId)
    await assertProjectCanEdit(projectId, uid)

    await requireWorkspaceMember(workspaceId, uid)

    await projectRef.update({ workspaceId })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message.includes("Authorization") ? 401 : message.includes("Forbidden") || message.includes("Not a workspace member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
