import { NextResponse } from "next/server"
import { assertProjectCanEdit } from "@/lib/project-access"
import { pruneVersionsForRunIds } from "@/lib/project-versions/service"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
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

    const body = await req.json().catch(() => ({})) as { removeRunIds?: string[] }
    const removeRunIds = Array.isArray(body.removeRunIds)
      ? body.removeRunIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : []

    const result = await pruneVersionsForRunIds(projectId, removeRunIds)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message === "Forbidden" || message === "Project not found"
      ? message === "Forbidden" ? 403 : 404
      : message.includes("Authorization") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
