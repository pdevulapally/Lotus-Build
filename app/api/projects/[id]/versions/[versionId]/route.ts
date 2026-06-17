import { NextResponse } from "next/server"
import { assertProjectCanEdit } from "@/lib/project-access"
import { getProjectVersion } from "@/lib/project-versions/service"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
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
    const version = await getProjectVersion(projectId, versionId)
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    return NextResponse.json({ version })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message === "Forbidden" || message === "Project not found"
      ? message === "Forbidden" ? 403 : 404
      : message.includes("Authorization") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
