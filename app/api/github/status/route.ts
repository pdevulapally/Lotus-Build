import { NextResponse } from "next/server"
import { getGitHubToken, requireUserUid } from "@/lib/server-auth"
import { mapRouteError } from "@/lib/orchestrator/route-utils"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const token = await getGitHubToken(uid)
    return NextResponse.json({ connected: !!token })
  } catch (err: unknown) {
    return mapRouteError(err)
  }
}
