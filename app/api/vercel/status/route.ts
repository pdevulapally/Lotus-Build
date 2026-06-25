import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertProjectCanEdit } from "@/lib/project-access"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const url = new URL(req.url)
    const projectId = url.searchParams.get("projectId") || ""

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    const snap = await adminDb.collection("projects").doc(projectId).get()
    if (!snap.exists) {
      return NextResponse.json({ connected: false })
    }

    await assertProjectCanEdit(projectId, uid)
    const data = snap.data() as any

    const connected = !!data?.vercelToken || !!data?.vercelTokenEncrypted
    return NextResponse.json({ connected })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: 401 })
  }
}
