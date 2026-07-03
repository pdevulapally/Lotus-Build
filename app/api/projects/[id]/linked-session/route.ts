import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertProjectCanEdit } from "@/lib/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUserUid(req)
    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 })
    }

    await assertProjectCanEdit(projectId, uid)

    const sessionsSnap = await adminDb
      .collection("computerSessions")
      .where("projectId", "==", projectId)
      .limit(10)
      .get()

    const session = sessionsSnap.docs.find((doc) => {
      const data = doc.data() as { ownerId?: unknown }
      return data.ownerId === uid
    })

    return NextResponse.json({ sessionId: session?.id ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed"
    const status = message.includes("Authorization")
      ? 401
      : message.includes("Project not found")
        ? 404
        : message.includes("Forbidden")
          ? 403
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
