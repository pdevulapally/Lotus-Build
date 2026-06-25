import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { assertProjectCanEdit } from "@/lib/project-access"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
const MAX_SQL_CHARS = 200_000
const MAX_MIGRATION_NAME_CHARS = 120

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => ({}))
    const builderProjectId = (body?.builderProjectId ?? "").toString().trim()
    const sql = (body?.sql ?? "").toString()
    const name = (body?.name ?? "").toString().trim() || `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_migration`
    if (!builderProjectId || !sql.trim()) {
      return NextResponse.json({ error: "Missing builderProjectId or sql" }, { status: 400 })
    }
    if (sql.length > MAX_SQL_CHARS) {
      return NextResponse.json({ error: `SQL is too large. Maximum is ${MAX_SQL_CHARS} characters.` }, { status: 400 })
    }
    if (name.length > MAX_MIGRATION_NAME_CHARS) {
      return NextResponse.json({ error: `Migration name is too long. Maximum is ${MAX_MIGRATION_NAME_CHARS} characters.` }, { status: 400 })
    }

    await assertProjectCanEdit(builderProjectId, uid)

    const ref = adminDb.collection("migrations").doc()
    await ref.set({
      id: ref.id,
      builderProjectId,
      name,
      sql,
      status: "pending",
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ migration: { id: ref.id, builderProjectId, name, sql, status: "pending" } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create migration"
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const url = new URL(req.url)
    const builderProjectId = (url.searchParams.get("builderProjectId") ?? "").trim()
    if (!builderProjectId) {
      return NextResponse.json({ error: "Missing builderProjectId" }, { status: 400 })
    }

    await assertProjectCanEdit(builderProjectId, uid)

    const snap = await adminDb
      .collection("migrations")
      .where("builderProjectId", "==", builderProjectId)
      .orderBy("createdAt", "asc")
      .get()

    const migrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ migrations })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list migrations"
    const status = message.includes("Authorization") ? 401 : message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

