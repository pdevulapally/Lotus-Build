import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { encryptEnvVars } from "@/lib/encrypt-env"
import { assertProjectCanEdit } from "@/lib/project-access"

export const runtime = "nodejs"

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_ENV_VARS = 100
const MAX_ENV_VALUE_LENGTH = 20_000

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => ({}))
    const projectId = body?.projectId
    const envVars = body?.envVars
    if (!projectId || typeof envVars !== "object" || envVars === null) {
      return NextResponse.json(
        { error: "Missing projectId or envVars object" },
        { status: 400 }
      )
    }
    const record: Record<string, string> = {}
    for (const [k, v] of Object.entries(envVars)) {
      const key = typeof k === "string" ? k.trim() : ""
      if (!key) continue
      if (!ENV_KEY_PATTERN.test(key)) {
        return NextResponse.json({ error: `Invalid environment variable name: ${key}` }, { status: 400 })
      }
      if (typeof v === "string") {
        if (v.length > MAX_ENV_VALUE_LENGTH) {
          return NextResponse.json({ error: `Environment variable value is too large: ${key}` }, { status: 400 })
        }
        record[key] = v
      }
    }
    if (Object.keys(record).length > MAX_ENV_VARS) {
      return NextResponse.json({ error: `Too many environment variables. Maximum is ${MAX_ENV_VARS}.` }, { status: 400 })
    }
    const plain = JSON.stringify(record)
    const { encrypted } = encryptEnvVars(plain)
    const projectRef = adminDb.collection("projects").doc(projectId)
    await assertProjectCanEdit(projectId, uid)
    await projectRef.set(
      {
        envVarsEncrypted: encrypted,
        envVarNames: Object.keys(record),
        envVarsUpdatedAt: new Date(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    const status = message.includes("Authorization") ? 401 : message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
