import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureMobilePreview } from "@/lib/mobile-preview/ensure"
import { mapRouteError } from "@/lib/orchestrator/route-utils"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z.object({
  projectId: z.string().trim().min(1),
})

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const result = await ensureMobilePreview({
      projectId: parsed.data.projectId,
      userId: uid,
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

    return NextResponse.json({ sandbox: result.sandbox })
  } catch (err) {
    console.error("[mobile-preview] create failed:", err instanceof Error ? err.message : err)
    return mapRouteError(err)
  }
}
