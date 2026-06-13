import { NextResponse } from "next/server"
import { z } from "zod"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"
import { assertProjectCanEdit } from "@/lib/project-access"
import type { ComputerTimelineEvent } from "@/lib/computer-agent/types"
import { sanitizeConversationTurns } from "@/lib/computer-agent/conversation"
import { isProjectPlatform, normalizePlatform } from "@/lib/projects/platform"
import { normalizeComputerSessionMode } from "@/lib/computer-agent/session-modes"
import { createRuntimeCheckpoint, normalizeComputerAgentRuntime } from "@/lib/computer-agent/runtime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSessionSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).max(12000),
  model: z.string().trim().max(120).optional(),
  platform: z.enum(["web", "mobile"]).optional(),
  sessionMode: z.string().trim().optional(),
})

type ComputerSessionStatus = "idle" | "planning" | "running" | "error" | "complete"

const SESSION_STATUSES = new Set<ComputerSessionStatus>([
  "idle",
  "planning",
  "running",
  "complete",
  "error",
])

function serializeSession(id: string, data: Record<string, unknown>) {
  return {
    id,
    prompt: typeof data.prompt === "string" ? data.prompt : undefined,
    status: typeof data.status === "string" && SESSION_STATUSES.has(data.status as ComputerSessionStatus)
      ? (data.status as ComputerSessionStatus)
      : "idle",
    timeline: Array.isArray(data.timeline) ? (data.timeline as ComputerTimelineEvent[]) : [],
    conversationTurns: sanitizeConversationTurns(data.conversationTurns),
    previewUrl: typeof data.previewUrl === "string" ? data.previewUrl : null,
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    platform: isProjectPlatform(data.platform) ? data.platform : "web",
    sessionMode: normalizeComputerSessionMode(data.sessionMode),
    agentRuntime: normalizeComputerAgentRuntime(data.agentRuntime),
  }
}

export async function GET(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "Missing session id" }, { status: 400 })
    }

    const snap = await adminDb.collection("computerSessions").doc(id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== uid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json(serializeSession(snap.id, data))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed"
    const status = message.includes("Authorization") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const body = await req.json().catch(() => null)
    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (parsed.data.projectId) {
      await assertProjectCanEdit(parsed.data.projectId, uid)
    }

    const platform = normalizePlatform(parsed.data.platform)
    const sessionMode = normalizeComputerSessionMode(parsed.data.sessionMode)
    const now = new Date()
    let linkedProjectId = parsed.data.projectId

    if (!linkedProjectId && platform === "mobile") {
      const projectRef = adminDb.collection("projects").doc()
      await projectRef.set({
        prompt: parsed.data.prompt,
        ...(parsed.data.model ? { model: parsed.data.model } : {}),
        status: "pending",
        creationMode: "build",
        platform: "mobile",
        createdAt: now,
        updatedAt: now,
        ownerId: uid,
        visibility: "private",
        messages: [],
      })
      linkedProjectId = projectRef.id
    }

    const sessionRef = adminDb.collection("computerSessions").doc()
    const createdEvent: ComputerTimelineEvent = {
      id: `user-${sessionRef.id}`,
      title: "Session created",
      description: "The computer session was created.",
      status: "complete",
      kind: "user",
      createdAt: now.toISOString(),
      completedAt: now.toISOString(),
      index: 0,
    }

    const payload = {
      ownerId: uid,
      ...(linkedProjectId ? { projectId: linkedProjectId } : {}),
      prompt: parsed.data.prompt,
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      platform,
      sessionMode,
      status: "idle",
      agentRuntime: createRuntimeCheckpoint({
        phase: "idle",
        effectiveRequest: parsed.data.prompt,
        nextAction: "Wait for the first run.",
      }),
      timeline: [createdEvent],
      createdAt: now,
      updatedAt: now,
    }

    await sessionRef.set(payload)
    return NextResponse.json({ id: sessionRef.id, platform, sessionMode }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed"
    const status = message.includes("Authorization") ? 401 : message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
