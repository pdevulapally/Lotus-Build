import {
  normalizeAgentRuntimePhase,
  normalizeSetupCategory,
  type AgentRuntimeMode,
  type AgentRuntimeSnapshot,
  type AgentSetupRequirement,
} from "@/lib/agent-runtime"
import type {
  BlueprintItem,
  BlueprintItemStatus,
  BlueprintSection,
  GeneratedFile,
  Message,
  PlanningStatus,
  Project,
  ProjectBlueprint,
  ProjectCreationMode,
  ProjectVisibility,
  WebsiteSettings,
} from "@/lib/projects/types"
import { normalizePlatform } from "@/lib/projects/platform"

type TimestampLike = { toDate: () => Date }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    const parsed = (value as TimestampLike).toDate()
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    const parsed = (value as TimestampLike).toDate()
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined
  }
  return undefined
}

function normalizeFiles(value: unknown): GeneratedFile[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((file) => ({
      path: typeof file.path === "string" ? file.path : "",
      content: typeof file.content === "string" ? file.content : "",
      ...(typeof file.isGenerating === "boolean" ? { isGenerating: file.isGenerating } : {}),
    }))
    .filter((file) => file.path.length > 0)
}

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .flatMap((message): Message[] => {
      if (message.role !== "user" && message.role !== "assistant") return []
      if (typeof message.content !== "string") return []

      return [{
        role: message.role,
        content: message.content,
        ...(Array.isArray(message.files)
          ? { files: message.files.filter((file): file is string => typeof file === "string") }
          : {}),
        ...(typeof message.isStreaming === "boolean" ? { isStreaming: message.isStreaming } : {}),
        ...(typeof message.timestamp === "string" ? { timestamp: message.timestamp } : {}),
      }]
    })
}

function normalizeVisibility(value: unknown): ProjectVisibility {
  return value === "public" || value === "link-only" ? value : "private"
}

function normalizePlanningStatus(value: unknown): PlanningStatus | undefined {
  return value === "draft" ||
    value === "needs-input" ||
    value === "plan-generated" ||
    value === "approved" ||
    value === "skipped"
    ? value
    : undefined
}

function normalizeCreationMode(value: unknown): ProjectCreationMode | undefined {
  return value === "build" || value === "agent" ? value : undefined
}

function normalizeStatus(value: unknown): Project["status"] {
  return value === "generating" || value === "complete" || value === "error" ? value : "pending"
}

function normalizeBlueprintItemStatus(value: unknown): BlueprintItemStatus {
  return value === "confirmed" || value === "suggested" || value === "unknown" ? value : "unknown"
}

function normalizeBlueprintItems(value: unknown): BlueprintItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .flatMap((item): BlueprintItem[] => {
      if (typeof item.key !== "string" || !item.key.trim()) return []
      if (typeof item.label !== "string" || !item.label.trim()) return []

      return [{
        key: item.key,
        label: item.label,
        value: typeof item.value === "string" ? item.value : "",
        status: normalizeBlueprintItemStatus(item.status),
      }]
    })
}

function normalizeBlueprintSections(value: unknown): BlueprintSection[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .flatMap((section): BlueprintSection[] => {
      if (typeof section.id !== "string" || !section.id.trim()) return []
      if (typeof section.title !== "string" || !section.title.trim()) return []

      return [{
        id: section.id,
        title: section.title,
        ...(typeof section.description === "string" ? { description: section.description } : {}),
        items: normalizeBlueprintItems(section.items),
      }]
    })
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function normalizeBlueprint(value: unknown): ProjectBlueprint | undefined {
  if (!isRecord(value)) return undefined

  const summary = typeof value.summary === "string" ? value.summary : ""
  const sections = normalizeBlueprintSections(value.sections)
  const openQuestions = normalizeStringArray(value.openQuestions)
  const assumptions = normalizeStringArray(value.assumptions)
  if (!summary && sections.length === 0 && openQuestions.length === 0 && assumptions.length === 0) {
    return undefined
  }

  const readiness = typeof value.readiness === "number" && Number.isFinite(value.readiness)
    ? Math.min(100, Math.max(0, value.readiness))
    : 0

  return { summary, readiness, sections, openQuestions, assumptions }
}

function normalizeAgentRuntimeMode(value: unknown): AgentRuntimeMode | undefined {
  return value === "builder" || value === "agent" ? value : undefined
}

function normalizeAgentSetupRequirements(value: unknown): AgentSetupRequirement[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .flatMap((requirement): AgentSetupRequirement[] => {
      const category = typeof requirement.category === "string" ? normalizeSetupCategory(requirement.category) : null
      if (!category) return []
      if (typeof requirement.reason !== "string" || !requirement.reason.trim()) return []
      if (typeof requirement.blocking !== "boolean") return []

      const metadata = isRecord(requirement.metadata)
        ? Object.fromEntries(
            Object.entries(requirement.metadata).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : undefined

      return [{
        category,
        reason: requirement.reason,
        blocking: requirement.blocking,
        ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
      }]
    })
}

function normalizeAgentRuntime(value: unknown): AgentRuntimeSnapshot | undefined {
  if (!isRecord(value)) return undefined

  const mode = normalizeAgentRuntimeMode(value.mode)
  const phase = typeof value.phase === "string" ? normalizeAgentRuntimePhase(value.phase) : null
  if (!mode || !phase) return undefined

  return {
    mode,
    phase,
    setupRequirements: normalizeAgentSetupRequirements(value.setupRequirements),
    ...(typeof value.blockedReason === "string" ? { blockedReason: value.blockedReason } : {}),
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim()
      ? value.updatedAt
      : new Date().toISOString(),
  }
}

function normalizeWebsiteSettings(value: unknown): WebsiteSettings | undefined {
  if (!isRecord(value)) return undefined

  return {
    ...(typeof value.siteName === "string" ? { siteName: value.siteName } : {}),
    ...(Array.isArray(value.envVars)
      ? {
          envVars: value.envVars
            .filter(isRecord)
            .map((envVar) => ({
              key: typeof envVar.key === "string" ? envVar.key : "",
              value: typeof envVar.value === "string" ? envVar.value : "",
            }))
            .filter((envVar) => envVar.key),
        }
      : {}),
  }
}

export function normalizeProject(
  value: unknown,
  options?: { fallbackId?: string; fallbackCreatedAt?: Date }
): Project {
  const record = isRecord(value) ? value : {}
  const fallbackCreatedAt = options?.fallbackCreatedAt ?? new Date()

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : (options?.fallbackId ?? ""),
    name: typeof record.name === "string" ? record.name : undefined,
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    model: typeof record.model === "string" ? record.model : undefined,
    status: normalizeStatus(record.status),
    workspaceId: typeof record.workspaceId === "string" ? record.workspaceId : undefined,
    files: normalizeFiles(record.files),
    sandboxUrl: typeof record.sandboxUrl === "string" ? record.sandboxUrl : undefined,
    sandboxId: typeof record.sandboxId === "string" ? record.sandboxId : undefined,
    mobileSandboxId: typeof record.mobileSandboxId === "string" ? record.mobileSandboxId : undefined,
    mobilePreviewEnsuredAt: toOptionalDate(record.mobilePreviewEnsuredAt),
    createdAt: toDate(record.createdAt, fallbackCreatedAt),
    messages: normalizeMessages(record.messages),
    error: typeof record.error === "string" ? record.error : undefined,
    tokensUsed: typeof record.tokensUsed === "number" ? record.tokensUsed : undefined,
    githubRepoUrl: typeof record.githubRepoUrl === "string" ? record.githubRepoUrl : undefined,
    githubRepoFullName: typeof record.githubRepoFullName === "string" ? record.githubRepoFullName : undefined,
    githubInstallationId: typeof record.githubInstallationId === "number" ? record.githubInstallationId : undefined,
    githubSyncedAt: toOptionalDate(record.githubSyncedAt),
    suggestsBackend: typeof record.suggestsBackend === "boolean" ? record.suggestsBackend : undefined,
    generationMeta: isRecord(record.generationMeta) ? (record.generationMeta as Project["generationMeta"]) : undefined,
    agentRuntime: normalizeAgentRuntime(record.agentRuntime),
    supabaseUrl: typeof record.supabaseUrl === "string" ? record.supabaseUrl : undefined,
    supabaseProjectRef: typeof record.supabaseProjectRef === "string" ? record.supabaseProjectRef : undefined,
    visibility: normalizeVisibility(record.visibility),
    ownerId: typeof record.ownerId === "string" ? record.ownerId : undefined,
    editorIds: Array.isArray(record.editorIds) ? record.editorIds.filter((id): id is string => typeof id === "string") : [],
    netlifySiteId: typeof record.netlifySiteId === "string" ? record.netlifySiteId : undefined,
    netlifySiteUrl: typeof record.netlifySiteUrl === "string" ? record.netlifySiteUrl : undefined,
    netlifyAdminUrl: typeof record.netlifyAdminUrl === "string" ? record.netlifyAdminUrl : undefined,
    netlifyDeployId: typeof record.netlifyDeployId === "string" ? record.netlifyDeployId : undefined,
    netlifyDeployUrl: typeof record.netlifyDeployUrl === "string" ? record.netlifyDeployUrl : undefined,
    vercelProjectName: typeof record.vercelProjectName === "string" ? record.vercelProjectName : undefined,
    vercelSiteUrl: typeof record.vercelSiteUrl === "string" ? record.vercelSiteUrl : undefined,
    vercelDeployUrl: typeof record.vercelDeployUrl === "string" ? record.vercelDeployUrl : undefined,
    vercelDeploymentId: typeof record.vercelDeploymentId === "string" ? record.vercelDeploymentId : undefined,
    websiteSettings: normalizeWebsiteSettings(record.websiteSettings),
    blueprint: normalizeBlueprint(record.blueprint),
    planningStatus: normalizePlanningStatus(record.planningStatus),
    creationMode: normalizeCreationMode(record.creationMode),
    platform: normalizePlatform(record.platform),
    currentVersionId: typeof record.currentVersionId === "string" ? record.currentVersionId : undefined,
    versionCount: typeof record.versionCount === "number" ? record.versionCount : undefined,
  }
}

export function serializeProjectForApi(value: unknown, fallbackId?: string): Record<string, unknown> {
  const project = normalizeProject(value, { fallbackId })

  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    ...(project.githubSyncedAt instanceof Date ? { githubSyncedAt: project.githubSyncedAt.toISOString() } : {}),
    ...(project.mobilePreviewEnsuredAt instanceof Date ? { mobilePreviewEnsuredAt: project.mobilePreviewEnsuredAt.toISOString() } : {}),
  }
}

export function serializePublicProjectForApi(value: unknown, fallbackId?: string): Record<string, unknown> {
  const project = normalizeProject(value, { fallbackId })

  return {
    id: project.id,
    name: project.name,
    prompt: project.prompt,
    model: project.model,
    status: project.status,
    visibility: project.visibility,
    createdAt: project.createdAt.toISOString(),
    platform: project.platform,
    planningStatus: project.planningStatus,
    creationMode: project.creationMode,
    blueprint: project.blueprint,
    netlifySiteUrl: project.netlifySiteUrl,
    netlifyDeployUrl: project.netlifyDeployUrl,
    vercelSiteUrl: project.vercelSiteUrl,
    vercelDeployUrl: project.vercelDeployUrl,
  }
}

export function serializeProjectListItemForApi(value: unknown, fallbackId?: string): Record<string, unknown> {
  const record = isRecord(value) ? value : {}
  const project = normalizeProject(value, { fallbackId })
  const updatedAt = toOptionalDate(record.updatedAt)

  return {
    id: project.id,
    name: project.name,
    prompt: project.prompt,
    model: project.model,
    status: project.status,
    visibility: project.visibility,
    workspaceId: project.workspaceId,
    createdAt: project.createdAt.toISOString(),
    ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}),
    platform: project.platform,
    planningStatus: project.planningStatus,
    creationMode: project.creationMode,
    netlifySiteUrl: project.netlifySiteUrl,
    vercelSiteUrl: project.vercelSiteUrl,
  }
}
