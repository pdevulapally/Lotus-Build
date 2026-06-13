import "server-only"

import type { DocumentSnapshot } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { normalizePlatform, type ProjectPlatform } from "@/lib/projects/platform"

export interface OwnedProjectRecord {
  snap: DocumentSnapshot
  ownerId: string
  platform: ProjectPlatform
}

export async function loadOwnedProject(
  projectId: string,
  uid: string,
): Promise<OwnedProjectRecord> {
  const snap = await adminDb.collection("projects").doc(projectId).get()
  if (!snap.exists) {
    throw new Error("Project not found")
  }

  const data = snap.data() as { ownerId?: string; platform?: unknown }
  if (!data.ownerId || data.ownerId !== uid) {
    throw new Error("Forbidden")
  }

  return {
    snap,
    ownerId: data.ownerId,
    platform: normalizePlatform(data.platform),
  }
}

export async function loadOwnedMobileProject(
  projectId: string,
  uid: string,
): Promise<OwnedProjectRecord> {
  const project = await loadOwnedProject(projectId, uid)
  if (project.platform !== "mobile") {
    throw new Error("Project is not a mobile project")
  }
  return project
}
