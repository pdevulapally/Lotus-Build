import "server-only"

import { adminDb } from "@/lib/firebase-admin"
import {
  ensureSandbox,
  getSandbox,
  sandboxHeartbeat,
  writeSandboxFiles,
  type Sandbox,
  type SandboxFile,
} from "@/lib/orchestrator/client"
import { loadOwnedMobileProject } from "@/lib/orchestrator/project"
import { resolveTier } from "@/lib/orchestrator/tier"
import { normalizeProjectFiles } from "@/lib/mobile-preview/files"

export type EnsureMobilePreviewResult =
  | { kind: "sandbox"; sandbox: Sandbox; synced: boolean; recovered: boolean }
  | { kind: "queue_full"; message: string }
  | { kind: "no_files"; message: string }

const ACTIVE_STATUSES = new Set<Sandbox["status"]>(["queued", "starting", "running", "stopping"])

async function persistMobileSandbox(projectId: string, sandboxId: string) {
  await adminDb.collection("projects").doc(projectId).set(
    {
      mobileSandboxId: sandboxId,
      mobilePreviewEnsuredAt: new Date(),
    },
    { merge: true },
  )
}

async function clearStaleMobileSandbox(projectId: string) {
  await adminDb.collection("projects").doc(projectId).set(
    { mobileSandboxId: null },
    { merge: true },
  )
}

async function syncFilesToSandbox(sandboxId: string, files: SandboxFile[]): Promise<boolean> {
  if (!files.length) return false
  await writeSandboxFiles(sandboxId, files)
  return true
}

export async function ensureMobilePreview(input: {
  projectId: string
  userId: string
  force?: boolean
  files?: SandboxFile[]
}): Promise<EnsureMobilePreviewResult> {
  const project = await loadOwnedMobileProject(input.projectId, input.userId)
  const projectData = project.snap.data() as {
    files?: unknown
    mobileSandboxId?: string
  }

  const files = input.files ?? normalizeProjectFiles(projectData.files)
  if (!files.length) {
    return { kind: "no_files", message: "Project has no files to preview yet." }
  }

  const tier = await resolveTier(input.userId)
  const storedSandboxId =
    typeof projectData.mobileSandboxId === "string" ? projectData.mobileSandboxId : ""

  if (!input.force && storedSandboxId) {
    const existing = await getSandbox(storedSandboxId)

    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      try {
        const synced = await syncFilesToSandbox(existing.id, files)
        if (existing.status === "running") {
          await sandboxHeartbeat(existing.id).catch(() => undefined)
        }
        await persistMobileSandbox(input.projectId, existing.id)
        return { kind: "sandbox", sandbox: existing, synced, recovered: false }
      } catch (err) {
        console.warn("[ensure-mobile-preview] reuse failed, recreating sandbox:", err)
        await clearStaleMobileSandbox(input.projectId)
      }
    } else {
      await clearStaleMobileSandbox(input.projectId)
    }
  }

  const result = await ensureSandbox({
    projectId: input.projectId,
    userId: input.userId,
    tier,
    files,
  })

  if (result.kind === "queue_full") {
    return { kind: "queue_full", message: result.message }
  }

  const sandbox = result.sandbox
  let synced = files.length > 0

  if (sandbox.status === "running") {
    try {
      synced = await syncFilesToSandbox(sandbox.id, files)
      await sandboxHeartbeat(sandbox.id).catch(() => undefined)
    } catch (err) {
      console.warn("[ensure-mobile-preview] post-ensure file sync failed:", err)
      synced = false
    }
  }

  await persistMobileSandbox(input.projectId, sandbox.id)

  return {
    kind: "sandbox",
    sandbox,
    synced,
    recovered: true,
  }
}
