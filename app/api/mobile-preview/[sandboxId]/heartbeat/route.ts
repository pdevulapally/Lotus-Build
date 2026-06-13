import { NextResponse } from "next/server"
import { z } from "zod"
import { sandboxHeartbeat } from "@/lib/orchestrator/client"
import { loadOwnedMobileProject } from "@/lib/orchestrator/project"
import { mapRouteError } from "@/lib/orchestrator/route-utils"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const heartbeatSchema = z.object({
  projectId: z.string().trim().min(1),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ sandboxId: string }> },
) {
  try {
    const uid = await requireUserUid(req)
    const { sandboxId } = await ctx.params
    const body = await req.json().catch(() => null)
    const parsed = heartbeatSchema.safeParse(body)

    if (!sandboxId) {
      return NextResponse.json({ error: "Missing sandbox id" }, { status: 400 })
    }
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    await loadOwnedMobileProject(parsed.data.projectId, uid)
    await sandboxHeartbeat(sandboxId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return mapRouteError(err)
  }
}
