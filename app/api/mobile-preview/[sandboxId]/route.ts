import { NextResponse } from "next/server"
import { z } from "zod"
import { destroySandbox, getSandbox } from "@/lib/orchestrator/client"
import { loadOwnedMobileProject } from "@/lib/orchestrator/project"
import { mapRouteError } from "@/lib/orchestrator/route-utils"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const projectIdSchema = z.string().trim().min(1)

async function resolveProjectId(req: Request): Promise<string> {
  const { searchParams } = new URL(req.url)
  const parsed = projectIdSchema.safeParse(searchParams.get("projectId"))
  if (!parsed.success) {
    throw new Error("Missing project id")
  }
  return parsed.data
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ sandboxId: string }> },
) {
  try {
    const uid = await requireUserUid(req)
    const { sandboxId } = await ctx.params
    const projectId = await resolveProjectId(req)

    if (!sandboxId) {
      return NextResponse.json({ error: "Missing sandbox id" }, { status: 400 })
    }

    await loadOwnedMobileProject(projectId, uid)
    const sandbox = await getSandbox(sandboxId)

    if (!sandbox) {
      return NextResponse.json({ expired: true })
    }

    return NextResponse.json({ sandbox })
  } catch (err) {
    if (err instanceof Error && err.message === "Missing project id") {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return mapRouteError(err)
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ sandboxId: string }> },
) {
  try {
    const uid = await requireUserUid(req)
    const { sandboxId } = await ctx.params
    const projectId = await resolveProjectId(req)

    if (!sandboxId) {
      return NextResponse.json({ error: "Missing sandbox id" }, { status: 400 })
    }

    await loadOwnedMobileProject(projectId, uid)
    await destroySandbox(sandboxId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === "Missing project id") {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return mapRouteError(err)
  }
}
