import { adminDb } from "@/lib/firebase-admin"

type ProjectAuthData = {
  ownerId?: string
  userId?: string
  editorIds?: string[]
  visibility?: string
}

export async function assertProjectCanEdit(projectId: string, uid: string) {
  const snap = await adminDb.collection("projects").doc(projectId).get()
  if (!snap.exists) {
    throw new Error("Project not found")
  }
  const data = snap.data() as ProjectAuthData

  const canonicalOwnerId = data.ownerId || data.userId
  if (!canonicalOwnerId) {
    console.warn(`[security] assertProjectCanEdit: project ${projectId} has no ownerId/userId — denied for ${uid}`)
    throw new Error("Forbidden")
  }

  const isOwner = canonicalOwnerId === uid
  const isEditor = Array.isArray(data.editorIds) && data.editorIds.includes(uid)
  if (!isOwner && !isEditor) {
    throw new Error("Forbidden")
  }
  return { snap, data }
}

export async function assertSessionOwner(sessionId: string, uid: string) {
  const snap = await adminDb.collection("computerSessions").doc(sessionId).get()
  if (!snap.exists) {
    throw new Error("Session not found")
  }
  const data = snap.data() as { ownerId?: string }
  if (data.ownerId && data.ownerId !== uid) {
    throw new Error("Forbidden")
  }
  return { snap, data }
}

