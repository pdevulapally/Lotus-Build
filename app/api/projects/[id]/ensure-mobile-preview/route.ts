import { NextResponse } from "next/server"
import { ensureMobilePreview } from "@/lib/mobile-preview/ensure"
import { mapRouteError } from "@/lib/orchestrator/route-utils"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const uid = await requireUserUid(req)
    const { id: projectId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const force = !!body?.force

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 })
    }

    const result = await ensureMobilePreview({
      projectId,
      userId: uid,
      force,
    })

    if (result.kind === "no_files") {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    if (result.kind === "queue_full") {
      return NextResponse.json({
        queueFull: true,
        message: result.message,
      })
    }

    return NextResponse.json({
      sandbox: result.sandbox,
      synced: result.synced,
      recovered: result.recovered,
    })
  } catch (err) {
    console.error("[ensure-mobile-preview] failed:", err instanceof Error ? err.message : err)
    return mapRouteError(err)
  }
}
