import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { serializeProjectListItemForApi } from "@/lib/project-shape"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireWorkspaceMember(workspaceId: string, uid: string) {
  const memberDocId = `${workspaceId}_${uid}`
  const snap = await adminDb.collection("workspace_members").doc(memberDocId).get()
  if (!snap.exists) {
    throw new Error("Not a workspace member")
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await requireUserUid(req)
    const { id: workspaceId } = await params
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 })
    }

    await requireWorkspaceMember(workspaceId, uid)

    const snap = await adminDb.collection("projects").where("workspaceId", "==", workspaceId).get()
    const projects = snap.docs.map((d) => serializeProjectListItemForApi({ id: d.id, ...d.data() }, d.id))

    return NextResponse.json({ projects })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message.includes("Authorization") ? 401 : message.includes("Not a workspace member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
