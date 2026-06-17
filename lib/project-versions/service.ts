import { adminDb } from "@/lib/firebase-admin"
import type { GeneratedFile } from "@/lib/projects/types"
import { deriveVersionLabel } from "@/lib/project-versions/labels"
import {
  MAX_VERSIONS_PER_PROJECT,
  type CreateProjectVersionInput,
  type ProjectVersion,
  type ProjectVersionSummary,
} from "@/lib/project-versions/types"
import type { ComputerConversationTurn, ComputerTimelineEvent } from "@/lib/computer-agent/types"

type ProjectFile = { path: string; content: string }

function versionsRef(projectId: string) {
  return adminDb.collection("projects").doc(projectId).collection("versions")
}

function normalizeFiles(files: ProjectFile[]): GeneratedFile[] {
  return files
    .filter((file) => typeof file.path === "string" && file.path.trim())
    .map((file) => ({
      path: file.path.trim(),
      content: typeof file.content === "string" ? file.content : "",
    }))
}

/** Firestore rejects undefined field values — omit optional fields when unset. */
function versionToFirestore(version: ProjectVersion): Record<string, unknown> {
  return {
    id: version.id,
    projectId: version.projectId,
    ...(version.sessionId ? { sessionId: version.sessionId } : {}),
    ...(version.runId ? { runId: version.runId } : {}),
    label: version.label,
    ...(version.summary ? { summary: version.summary } : {}),
    files: version.files,
    fileCount: version.fileCount,
    source: version.source,
    createdAt: version.createdAt,
  }
}

function toSummary(version: ProjectVersion): ProjectVersionSummary {
  return {
    id: version.id,
    projectId: version.projectId,
    sessionId: version.sessionId,
    runId: version.runId,
    label: version.label,
    summary: version.summary,
    fileCount: version.fileCount,
    source: version.source,
    createdAt: version.createdAt,
  }
}

function docToVersion(id: string, data: Record<string, unknown>): ProjectVersion {
  const files = Array.isArray(data.files) ? normalizeFiles(data.files) : []
  return {
    id,
    projectId: String(data.projectId || ""),
    sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    runId: typeof data.runId === "string" ? data.runId : undefined,
    label: typeof data.label === "string" ? data.label : "Update",
    summary: typeof data.summary === "string" ? data.summary : undefined,
    files,
    fileCount: typeof data.fileCount === "number" ? data.fileCount : files.length,
    source: data.source === "run" || data.source === "restore" || data.source === "fix" || data.source === "branch"
      ? data.source
      : "run",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  }
}

export async function enforceVersionCap(projectId: string) {
  const snap = await versionsRef(projectId)
    .orderBy("createdAt", "asc")
    .get()

  const overflow = snap.docs.length - MAX_VERSIONS_PER_PROJECT
  if (overflow <= 0) return

  const batch = adminDb.batch()
  for (const doc of snap.docs.slice(0, overflow)) {
    batch.delete(doc.ref)
  }
  await batch.commit()
}

export async function createProjectVersion(input: CreateProjectVersionInput): Promise<ProjectVersion> {
  const files = normalizeFiles(input.files)
  if (!files.length) {
    throw new Error("Cannot create version without files")
  }

  const versionRef = versionsRef(input.projectId).doc()
  const createdAt = new Date().toISOString()
  const version: ProjectVersion = {
    id: versionRef.id,
    projectId: input.projectId,
    sessionId: input.sessionId,
    runId: input.runId,
    label: input.label,
    summary: input.summary,
    files,
    fileCount: files.length,
    source: input.source,
    createdAt,
  }

  await versionRef.set(versionToFirestore(version))
  const allVersions = await versionsRef(input.projectId).get()
  await adminDb.collection("projects").doc(input.projectId).update({
    currentVersionId: version.id,
    versionCount: allVersions.size,
    updatedAt: new Date(),
  })
  await enforceVersionCap(input.projectId)

  return version
}

export async function listProjectVersionSummaries(projectId: string): Promise<{
  versions: ProjectVersionSummary[]
  currentVersionId: string | null
}> {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get()
  if (!projectSnap.exists) {
    throw new Error("Project not found")
  }

  const projectData = projectSnap.data() as {
    currentVersionId?: string
    files?: ProjectFile[]
  }

  const snap = await versionsRef(projectId).orderBy("createdAt", "desc").get()
  let versions = snap.docs.map((doc) => toSummary(docToVersion(doc.id, doc.data())))

  if (versions.length === 0 && Array.isArray(projectData.files) && projectData.files.length > 0) {
    const initial = await ensureInitialVersion(projectId, projectData.files)
    versions = [toSummary(initial)]
  }

  return {
    versions,
    currentVersionId: projectData.currentVersionId ?? versions[0]?.id ?? null,
  }
}

export async function getProjectVersion(
  projectId: string,
  versionId: string
): Promise<ProjectVersion | null> {
  const snap = await versionsRef(projectId).doc(versionId).get()
  if (!snap.exists) return null
  return docToVersion(snap.id, snap.data() || {})
}

export async function ensureInitialVersion(
  projectId: string,
  files: ProjectFile[]
): Promise<ProjectVersion> {
  const normalized = normalizeFiles(files)
  if (!normalized.length) {
    throw new Error("Project has no files to snapshot")
  }

  const existing = await versionsRef(projectId).limit(1).get()
  if (!existing.empty) {
    const doc = existing.docs[0]
    return docToVersion(doc.id, doc.data() || {})
  }

  return createProjectVersion({
    projectId,
    label: "Initial build",
    files: normalized,
    source: "run",
  })
}

export async function createRunVersion(params: {
  projectId: string
  sessionId?: string
  runId?: string
  files: ProjectFile[]
  conversationTurns?: ComputerConversationTurn[]
  timeline?: ComputerTimelineEvent[]
  firstRunId?: string | null
  source?: CreateProjectVersionInput["source"]
  explicitLabel?: string
}): Promise<ProjectVersion | null> {
  const files = normalizeFiles(params.files)
  if (!files.length) return null

  if (params.runId) {
    const existingForRun = await versionsRef(params.projectId)
      .where("runId", "==", params.runId)
      .limit(1)
      .get()
    if (!existingForRun.empty) {
      const existing = existingForRun.docs[0]
      const versionRef = existing.ref
      const { label, summary } = deriveVersionLabel({
        runId: params.runId,
        firstRunId: params.firstRunId,
        conversationTurns: params.conversationTurns,
        timeline: params.timeline,
        source: params.source,
        explicitLabel: params.explicitLabel,
      })
      const updated: ProjectVersion = {
        id: existing.id,
        projectId: params.projectId,
        sessionId: params.sessionId,
        runId: params.runId,
        label,
        summary,
        files,
        fileCount: files.length,
        source: params.source || "run",
        createdAt: typeof existing.data()?.createdAt === "string"
          ? existing.data()!.createdAt
          : new Date().toISOString(),
      }
      await versionRef.set(versionToFirestore(updated))
      await adminDb.collection("projects").doc(params.projectId).update({
        currentVersionId: updated.id,
        updatedAt: new Date(),
      })
      return updated
    }
  }

  const { label, summary } = deriveVersionLabel({
    runId: params.runId,
    firstRunId: params.firstRunId,
    conversationTurns: params.conversationTurns,
    timeline: params.timeline,
    source: params.source,
    explicitLabel: params.explicitLabel,
  })

  return createProjectVersion({
    projectId: params.projectId,
    sessionId: params.sessionId,
    runId: params.runId,
    label,
    summary,
    files,
    source: params.source || "run",
  })
}

export async function restoreProjectVersion(
  projectId: string,
  versionId: string
): Promise<{ restoredVersionId: string; savedVersionId: string }> {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get()
  if (!projectSnap.exists) {
    throw new Error("Project not found")
  }

  const target = await getProjectVersion(projectId, versionId)
  if (!target) {
    throw new Error("Version not found")
  }

  const projectData = projectSnap.data() as { files?: ProjectFile[]; currentVersionId?: string }
  const currentFiles = Array.isArray(projectData.files) ? normalizeFiles(projectData.files) : []

  let savedVersionId = projectData.currentVersionId || ""
  if (currentFiles.length > 0 && projectData.currentVersionId !== versionId) {
    const saved = await createProjectVersion({
      projectId,
      label: "Saved before restore",
      files: currentFiles,
      source: "restore",
    })
    savedVersionId = saved.id
  }

  await adminDb.collection("projects").doc(projectId).update({
    files: target.files,
    currentVersionId: target.id,
    updatedAt: new Date(),
  })

  return { restoredVersionId: target.id, savedVersionId }
}

export async function pruneVersionsForRunIds(
  projectId: string,
  removeRunIds: string[]
): Promise<{ restoredFiles: GeneratedFile[] | null; currentVersionId: string | null }> {
  const removeSet = new Set(removeRunIds.filter(Boolean))
  if (!removeSet.size) {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get()
    const data = projectSnap.data() as { currentVersionId?: string }
    return { restoredFiles: null, currentVersionId: data?.currentVersionId ?? null }
  }

  const snap = await versionsRef(projectId).orderBy("createdAt", "desc").get()
  const remaining: ProjectVersion[] = []
  const batch = adminDb.batch()

  for (const doc of snap.docs) {
    const version = docToVersion(doc.id, doc.data() || {})
    if (version.runId && removeSet.has(version.runId)) {
      batch.delete(doc.ref)
    } else {
      remaining.push(version)
    }
  }

  await batch.commit()

  const newest = remaining[0] ?? null
  if (newest) {
    await adminDb.collection("projects").doc(projectId).update({
      files: newest.files,
      currentVersionId: newest.id,
      updatedAt: new Date(),
    })
    return { restoredFiles: newest.files, currentVersionId: newest.id }
  }

  return { restoredFiles: null, currentVersionId: null }
}
