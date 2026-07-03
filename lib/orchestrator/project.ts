import "server-only"

import type { DocumentSnapshot } from "firebase-admin/firestore"
import { assertProjectCanEdit } from "@/lib/project-access"
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
  const { snap, data } = await assertProjectCanEdit(projectId, uid)
  const project = data as { ownerId?: string; userId?: string; platform?: unknown }

  return {
    snap,
    ownerId: project.ownerId || project.userId || "",
    platform: normalizePlatform(project.platform),
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
