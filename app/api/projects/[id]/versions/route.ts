import { NextResponse } from "next/server"
import { assertProjectCanEdit } from "@/lib/project-access"
import { listProjectVersionSummaries } from "@/lib/project-versions/service"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await requireUserUid(req)
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 })
    }

    await assertProjectCanEdit(projectId, uid)
    const result = await listProjectVersionSummaries(projectId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message === "Forbidden" || message === "Project not found"
      ? message === "Forbidden" ? 403 : 404
      : message.includes("Authorization") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
