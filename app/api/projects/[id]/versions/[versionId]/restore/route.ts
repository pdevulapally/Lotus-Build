import { NextResponse } from "next/server"
import { assertProjectCanEdit } from "@/lib/project-access"
import { restoreProjectVersion } from "@/lib/project-versions/service"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const uid = await requireUserUid(req)
    const { id: projectId, versionId } = await params
    if (!projectId || !versionId) {
      return NextResponse.json({ error: "Missing project or version id" }, { status: 400 })
    }

    await assertProjectCanEdit(projectId, uid)
    const result = await restoreProjectVersion(projectId, versionId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message === "Forbidden" || message === "Project not found" || message === "Version not found"
      ? message === "Forbidden" ? 403 : 404
      : message.includes("Authorization") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
