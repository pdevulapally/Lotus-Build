import type { GeneratedFile } from "@/lib/projects/types"

export type ProjectVersionSource = "run" | "restore" | "fix" | "branch"

export interface ProjectVersion {
  id: string
  projectId: string
  sessionId?: string
  runId?: string
  label: string
  summary?: string
  files: GeneratedFile[]
  fileCount: number
  source: ProjectVersionSource
  createdAt: string
}

export interface ProjectVersionSummary {
  id: string
  projectId: string
  sessionId?: string
  runId?: string
  label: string
  summary?: string
  fileCount: number
  source: ProjectVersionSource
  createdAt: string
}

export interface CreateProjectVersionInput {
  projectId: string
  sessionId?: string
  runId?: string
  label: string
  summary?: string
  files: GeneratedFile[]
  source: ProjectVersionSource
}

export const MAX_VERSIONS_PER_PROJECT = 50
