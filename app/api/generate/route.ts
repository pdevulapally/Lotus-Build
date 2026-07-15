import Anthropic from "@anthropic-ai/sdk"
import type {
  CacheControlEphemeral,
  MessageParam,
  RawMessageStreamEvent,
  TextBlockParam,
  Usage as AnthropicUsage,
} from "@anthropic-ai/sdk/resources/messages/messages"
import crypto from "crypto"
import OpenAI from "openai"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore"
import { z } from "zod"
import { normalizeGeneratedCodeFiles } from "@/lib/generated-code-normalization"
import {
  ensureGeneratedProjectScaffold,
  isForbiddenMobileWebFilePath,
  validateGeneratedProjectFiles,
  type GeneratedProjectFile,
} from "@/lib/generated-project-validation"
import { chargeTokensForGeneration } from "@/lib/charge-tokens"
import { InsufficientTokensError, MeteringUserNotFoundError, assertTokenBalance } from "@/lib/metering/ledger"
import { assertProjectCanEdit } from "@/lib/project-access"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"
import { isSensitiveFilePath, normalizeRelativeFilePath } from "@/lib/security/files"
import {
  buildMobileDesignBriefSuffix,
  buildMobileGenerationSystemPrompt,
  MOBILE_EXPO_DEPENDENCIES,
  MOBILE_MODEL_RELIABILITY_PROMPT,
} from "@/lib/generation/prompts/mobile"
import {
  buildWebDesignBriefSuffix,
  buildWebGenerationSystemPrompt,
  WEB_MODEL_RELIABILITY_PROMPT,
} from "@/lib/generation/prompts/web"
import { normalizePlatform, type ProjectPlatform } from "@/lib/projects/platform"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
})
let anthropicClient: Anthropic | null = null

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  anthropicClient ??= new Anthropic({ apiKey })
  return anthropicClient
}

const DEFAULT_MODEL = "GPT-5.5"  // Full model (not mini) - more capable for better library knowledge and code quality
const OPENAI_MODEL_MAP: Record<string, string> = {
  "o3-mini": "o3-mini",
  "GPT-5.5 Pro": "gpt-5.5-pro",
  "GPT-5.5": "gpt-5.5",
  "GPT-5.4 Pro": "gpt-5.4-pro",
  "GPT-5.4": "gpt-5.4",
  "GPT-5.4 Mini": "gpt-5.4-mini",
  "GPT-5.4 Nano": "gpt-5.4-nano",
  "GPT-5 Mini": "gpt-5-mini",
  "GPT-5 Nano": "gpt-5-nano",
  "GPT-4-1": "gpt-4.1",
}

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "Claude Sonnet 4.6": "claude-sonnet-4-6",
}

const CURATED_NVIDIA_MODELS = [
  "minimaxai/minimax-m2.1",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-405b-instruct",
  "deepseek-ai/deepseek-r1",
  "qwen/qwen2.5-coder-32b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  "google/gemma-3-27b-it",
]

const OPEN_SOURCE_MODEL_PATTERNS = [
  "meta/",
  "mistralai/",
  "deepseek-ai/",
  "qwen/",
  "google/gemma",
  "minimaxai/",
  "moonshotai/",
  "nvidia/",
]

let cachedNvidiaModels: { models: string[]; expiresAt: number } | null = null

type ParsedFileBlock = {
  path: string
  content: string
}

type ProjectFileInput = {
  path: string
  content: string
}

type Provider = "openai" | "nvidia" | "anthropic"
type GenerationType = "new" | "follow-up" | "inspiration"
type PromptCacheRetention = "in_memory" | "24h"
type ClaudePromptCacheTtl = "5m" | "1h"

type PromptCachePlan = {
  enabled: boolean
  key: string
  openaiRetention?: PromptCacheRetention
  claudeCacheControl?: CacheControlEphemeral
  cacheClaudeSystemPrompt: boolean
}

type ResolvedModel =
  | { client: OpenAI; provider: "openai" | "nvidia"; selectedModel: string }
  | { client: Anthropic; provider: "anthropic"; selectedModel: string }

type StreamState = {
  usageInfo: any
  streamedLength: number
  closed: boolean
}

const PROVIDER_CAPABILITIES: Record<Provider, {
  streaming: boolean
  promptCaching: "openai-automatic" | "claude-cache-control" | "none"
}> = {
  openai: { streaming: true, promptCaching: "openai-automatic" },
  anthropic: { streaming: true, promptCaching: "claude-cache-control" },
  nvidia: { streaming: false, promptCaching: "none" },
}

const FILE_SELECTION_LIMIT = 8
const FILE_CONTENT_SCAN_LIMIT = 1500
const PROMPT_KEYWORD_LIMIT = 12
const OPENAI_TIMEOUT_MS = 90000
const GENERATION_MAX_OUTPUT_TOKENS = (() => {
  const parsed = Number(process.env.GENERATION_MAX_OUTPUT_TOKENS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16000
})()
const MAX_CONTINUATION_ROUNDS = 2
const MAX_PROMPT_CHARS = 12000
const MAX_REQUEST_BODY_CHARS = 1_500_000
const MAX_FOLLOWUP_FILE_CONTEXT_CHARS = 200000
const MAX_EXISTING_FILES = 200
const MAX_EXISTING_FILE_CHARS = 200_000
const MAX_METADATA_KEYS = 20
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const IDEMPOTENCY_IN_PROGRESS_TTL_MS = 15 * 60 * 1000
const STRICT_FILE_FORMAT_RETRY_PROMPT = `Your previous response did not follow the required file format.

You MUST output ONLY file blocks using:

===FILE: path===
content
===END_FILE===

Do not include anything else.`
const PROMPT_KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "app",
  "build",
  "change",
  "create",
  "file",
  "for",
  "from",
  "in",
  "into",
  "make",
  "page",
  "project",
  "section",
  "site",
  "the",
  "this",
  "to",
  "update",
  "with",
])

class GenerateHttpError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "GenerateHttpError"
    this.status = status
    this.code = code
  }
}

class IdempotencyConflictError extends GenerateHttpError {
  constructor(status: "processing" | "completed") {
    super(
      409,
      `generation_${status}`,
      status === "processing"
        ? "A generation with this idempotency key is already running."
        : "This idempotency key has already completed."
    )
  }
}

const metadataValueSchema = z.union([
  z.string().trim().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

const requestMetadataSchema = z.record(z.string(), metadataValueSchema).superRefine((value, ctx) => {
  const keys = Object.keys(value)
  if (keys.length > MAX_METADATA_KEYS) {
    ctx.addIssue({
      code: "custom",
      message: `metadata cannot contain more than ${MAX_METADATA_KEYS} keys`,
    })
  }

  for (const key of keys) {
    if (key.length > 64 || !/^[a-zA-Z0-9_.:-]+$/.test(key)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "metadata keys must be 64 characters or fewer and use only letters, numbers, dot, underscore, colon, or dash",
      })
    }
  }
})

const projectIdSchema = z.string().trim().min(1).max(160).refine(
  (value) => !value.includes("/") && !value.includes("\\"),
  "projectId must be a Firestore document id, not a path"
)

const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  model: z.string().trim().min(1).max(120).optional(),
  provider: z.enum(["openai", "nvidia", "anthropic"]).optional(),
  idToken: z.string().trim().min(1).max(12000).optional(),
  projectId: projectIdSchema.optional(),
  existingFiles: z.array(z.object({
    path: z.string().trim().min(1).max(512),
    content: z.string().max(MAX_EXISTING_FILE_CHARS),
  }).strict()).max(MAX_EXISTING_FILES).optional(),
  intent: z.string().trim().max(80).optional(),
  generationType: z.enum(["new", "follow-up", "inspiration"]).optional(),
  maxTokens: z.number().int().min(512).max(GENERATION_MAX_OUTPUT_TOKENS).optional(),
  temperature: z.number().min(0).max(2).optional(),
  metadata: requestMetadataSchema.optional(),
  promptCaching: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_.:-]+$/).optional(),
  skipDesignBrief: z.boolean().optional(),
  inspirationContext: z.object({
    title: z.string().trim().max(500).default(""),
    description: z.string().trim().max(1000).default(""),
    markdown: z.string().max(8000).default(""),
    sourceUrl: z.string().trim().max(2048).default(""),
  }).strict().optional(),
}).strict()

type GenerateRequestBody = z.infer<typeof generateRequestSchema>

function jsonError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: message, code }, { status, headers })
}

function validationErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0]
  const path = firstIssue?.path?.length ? `${firstIssue.path.join(".")}: ` : ""
  return jsonError(400, "invalid_request", `${path}${firstIssue?.message || "Invalid request body"}`)
}

function getBearerToken(req: Request, body: GenerateRequestBody) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  return body.idToken?.trim() || bearerToken
}

function parsePromptCachingEnabled(requested?: boolean) {
  if (process.env.GENERATE_PROMPT_CACHING_ENABLED === "false") return false
  return requested !== false
}

function getClaudePromptCacheTtl(): ClaudePromptCacheTtl {
  return process.env.CLAUDE_PROMPT_CACHE_TTL === "1h" ? "1h" : "5m"
}

function getOpenAIPromptCacheRetention(model: string): PromptCacheRetention | undefined {
  const configured = process.env.OPENAI_PROMPT_CACHE_RETENTION
  if (configured === "24h") return "24h"
  if (configured === "in_memory" && !model.startsWith("gpt-5.5")) return "in_memory"
  return undefined
}

function buildPromptCachePlan(params: {
  provider: Provider
  selectedModel: string
  platform: ProjectPlatform
  generationType: GenerationType
  promptCaching?: boolean
  cacheClaudeSystemPrompt: boolean
}): PromptCachePlan {
  const enabled = parsePromptCachingEnabled(params.promptCaching)
  const key = [
    "lotus-generate-v1",
    params.provider,
    params.selectedModel,
    params.platform,
    params.generationType,
  ].join(":").replace(/[^a-zA-Z0-9_.:-]/g, "_")

  if (!enabled) {
    return { enabled: false, key, cacheClaudeSystemPrompt: false }
  }

  if (params.provider === "anthropic") {
    const ttl = getClaudePromptCacheTtl()
    return {
      enabled,
      key,
      cacheClaudeSystemPrompt: params.cacheClaudeSystemPrompt,
      claudeCacheControl: ttl === "1h" ? { type: "ephemeral", ttl } : { type: "ephemeral" },
    }
  }

  if (params.provider === "openai") {
    return {
      enabled,
      key,
      cacheClaudeSystemPrompt: false,
      openaiRetention: getOpenAIPromptCacheRetention(params.selectedModel),
    }
  }

  return { enabled, key, cacheClaudeSystemPrompt: false }
}

function normalizeAnthropicUsage(usage: AnthropicUsage | null | undefined) {
  if (!usage) return null
  const promptTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  return {
    prompt_tokens: promptTokens,
    completion_tokens: usage.output_tokens,
    total_tokens: promptTokens + usage.output_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  }
}

// A generation can span several provider calls (continuation, format retry,
// repair, salvage). Billing must SUM the usage of every call — assignment
// would charge only the last one.
function mergeUsageInfo(prev: any, next: any) {
  if (!next) return prev ?? null
  if (!prev) return { ...next }
  const sum = (a?: number | null, b?: number | null) => (a ?? 0) + (b ?? 0)
  const totalOf = (u: any) => u.total_tokens ?? sum(u.prompt_tokens, u.completion_tokens)
  return {
    prompt_tokens: sum(prev.prompt_tokens, next.prompt_tokens),
    completion_tokens: sum(prev.completion_tokens, next.completion_tokens),
    total_tokens: sum(totalOf(prev), totalOf(next)),
    cache_creation_input_tokens: sum(prev.cache_creation_input_tokens, next.cache_creation_input_tokens),
    cache_read_input_tokens: sum(prev.cache_read_input_tokens, next.cache_read_input_tokens),
  }
}

function addAnthropicUsage(prev: AnthropicUsage | null, next: AnthropicUsage | null): AnthropicUsage | null {
  if (!next) return prev
  if (!prev) return next
  return {
    ...prev,
    input_tokens: prev.input_tokens + next.input_tokens,
    output_tokens: prev.output_tokens + next.output_tokens,
    cache_creation_input_tokens:
      (prev.cache_creation_input_tokens ?? 0) + (next.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      (prev.cache_read_input_tokens ?? 0) + (next.cache_read_input_tokens ?? 0),
  } as AnthropicUsage
}

function getProviderErrorInfo(error: unknown) {
  const err = error as { status?: unknown; code?: unknown; type?: unknown; name?: unknown; message?: unknown }
  return {
    status: typeof err?.status === "number" ? err.status : undefined,
    code: typeof err?.code === "string" ? err.code : undefined,
    type: typeof err?.type === "string" ? err.type : undefined,
    name: typeof err?.name === "string" ? err.name : undefined,
    message: typeof err?.message === "string" ? err.message : undefined,
  }
}

function publicGenerationError(error: unknown) {
  if (error instanceof GenerateHttpError) {
    return { status: error.status, code: error.code, message: error.message }
  }

  const info = getProviderErrorInfo(error)
  if (info.message === "MODEL_TIMEOUT" || info.name === "AbortError") {
    return { status: 504, code: "model_timeout", message: "Generation timed out. Please try again." }
  }
  if (info.status === 401 || info.status === 403) {
    return { status: 502, code: "provider_auth_failed", message: "The model provider is not configured correctly." }
  }
  if (info.status === 429) {
    return { status: 429, code: "provider_rate_limited", message: "The model provider is busy. Please try again shortly." }
  }
  if (info.status && info.status >= 400 && info.status < 500) {
    return { status: 502, code: "provider_rejected_request", message: "The model provider rejected this generation request." }
  }
  return { status: 500, code: "generation_failed", message: "Generation failed. Please try again." }
}

function logGenerationError(context: Record<string, string | number | boolean | undefined>, error: unknown) {
  const info = getProviderErrorInfo(error)
  console.error("[generate]", {
    ...context,
    errorName: info.name,
    providerStatus: info.status,
    providerCode: info.code,
    providerType: info.type,
    message: info.message?.slice(0, 240),
  })
}

async function reserveIdempotencyKey(uid: string, key?: string) {
  if (!key) return null

  const now = Date.now()
  const id = crypto.createHash("sha256").update(`generate:${uid}:${key}`).digest("hex")
  const ref = adminDb.collection("generationIdempotency").doc(id)
  // Server-minted per reservation. The billing ledger event is keyed to THIS
  // id — never to the client-chosen key — so a user cannot craft or replay a
  // key (their own after TTL expiry, or another user's) that collides with an
  // existing usageEvents doc and dodges the charge via deduplication.
  const billingEventId = crypto.randomUUID()

  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref)
    const data = snap.exists ? snap.data() as {
      status?: string
      createdAtMs?: number
      updatedAtMs?: number
    } : null
    const ageMs = now - (data?.updatedAtMs || data?.createdAtMs || 0)

    if (data?.status === "processing" && ageMs < IDEMPOTENCY_IN_PROGRESS_TTL_MS) {
      throw new IdempotencyConflictError("processing")
    }
    if (data?.status === "completed" && ageMs < IDEMPOTENCY_TTL_MS) {
      throw new IdempotencyConflictError("completed")
    }

    transaction.set(ref, {
      uid,
      keyHash: id,
      status: "processing",
      billingEventId,
      createdAtMs: now,
      updatedAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return { ref, billingEventId }
}

async function completeIdempotencyKey(ref: DocumentReference | null, status: "completed" | "failed") {
  if (!ref) return
  await ref.set({
    status,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch((error) => {
    logGenerationError({ phase: "idempotency_update", status }, error)
  })
}

function dedupeFilesByPath(files: ProjectFileInput[]) {
  const seen = new Set<string>()
  return files.flatMap((file) => {
    const path = normalizeRelativeFilePath(file.path)
    if (!path || seen.has(path) || typeof file.content !== "string") return []
    if (isSensitiveFilePath(path)) return []
    seen.add(path)
    return [{ path, content: file.content.slice(0, MAX_EXISTING_FILE_CHARS) }]
  }).slice(0, MAX_EXISTING_FILES)
}

function isCoreContextFile(path: string) {
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase()
  return (
    normalizedPath === "package.json" ||
    normalizedPath === "vite.config.ts" ||
    normalizedPath === "index.html" ||
    normalizedPath === "src/index.css" ||
    normalizedPath === "tailwind.config.ts" ||
    normalizedPath === "postcss.config.js" ||
    normalizedPath === "app.tsx" ||
    normalizedPath === "main.tsx" ||
    normalizedPath === "src/app.tsx" ||
    normalizedPath === "src/main.tsx" ||
    normalizedPath.endsWith("/app.tsx") ||
    normalizedPath.endsWith("/main.tsx")
  )
}

function extractPromptKeywords(prompt: string) {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9/_.\-\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !PROMPT_KEYWORD_STOPWORDS.has(token))
    )
  ).slice(0, PROMPT_KEYWORD_LIMIT)
}

function scoreFileForPrompt(file: ProjectFileInput, keywords: string[]) {
  if (isCoreContextFile(file.path)) return Number.MAX_SAFE_INTEGER

  const normalizedPath = file.path.toLowerCase()
  const fileName = normalizedPath.split("/").pop() || normalizedPath
  const contentPreview = file.content.slice(0, FILE_CONTENT_SCAN_LIMIT).toLowerCase()
  let score = 0

  for (const keyword of keywords) {
    if (fileName.includes(keyword)) score += 8
    else if (normalizedPath.includes(keyword)) score += 5
    if (contentPreview.includes(keyword)) score += 2
  }

  return score
}

function extractRelativeImports(content: string): string[] {
  const importRegex = /from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g
  const imports: string[] = []
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(content)) !== null) {
    const raw = match[1] || match[2]
    if (raw && raw.startsWith(".")) {
      imports.push(raw)
    }
  }

  return imports
}

function resolveImportPath(basePath: string, relativePath: string): string {
  const baseDir = basePath.includes("/") ? basePath.slice(0, basePath.lastIndexOf("/")) : ""
  const combined = `${baseDir}/${relativePath}`

  const normalizedParts: string[] = []
  for (const part of combined.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      normalizedParts.pop()
      continue
    }
    normalizedParts.push(part)
  }

  return normalizedParts.join("/")
}

function collectDependencyFiles(
  files: ProjectFileInput[],
  seedFiles: ProjectFileInput[]
): ProjectFileInput[] {
  const fileMap = new Map(files.map((f) => [f.path, f]))
  const visited = new Set<string>()
  const result: ProjectFileInput[] = []

  const stack = [...seedFiles]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current.path)) continue

    visited.add(current.path)
    result.push(current)

    const imports = extractRelativeImports(current.content)

    for (const imp of imports) {
      const resolved = resolveImportPath(current.path, imp)

      const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        `${resolved}.js`,
        `${resolved}.jsx`,
        `${resolved}/index.tsx`,
        `${resolved}/index.ts`,
      ]

      for (const candidate of candidates) {
        const found = fileMap.get(candidate)
        if (found && !visited.has(found.path)) {
          stack.push(found)
        }
      }
    }
  }

  return result
}

function trimPromptFilesToBudget(
  prompt: string,
  files: ProjectFileInput[]
): ProjectFileInput[] {
  let totalLength = prompt.length
  const result: ProjectFileInput[] = []

  for (const file of files) {
    const fileLength = file.path.length + file.content.length + 50

    if (totalLength + fileLength > MAX_PROMPT_CHARS) break

    result.push(file)
    totalLength += fileLength
  }

  return result
}

function buildFollowUpUserMessage(
  prompt: string,
  files: ProjectFileInput[]
) {
  return `The user wants these changes or additions to their existing project:\n\n${prompt}\n\nCurrent project files (only modify or add as needed; do not output unchanged files):\n${files.map((f) => `\n--- FILE: ${f.path} ---\n${f.content}\n--- END ${f.path} ---`).join("")}`
}

function selectRelevantFiles(existingFiles: ProjectFileInput[], prompt: string) {
  const dedupedFiles = dedupeFilesByPath(existingFiles)
  if (dedupedFiles.length <= FILE_SELECTION_LIMIT) return dedupedFiles

  const keywords = extractPromptKeywords(prompt)
  const coreFiles = dedupedFiles.filter((file) => isCoreContextFile(file.path))
  const rankedNonCoreFiles = dedupedFiles
    .filter((file) => !isCoreContextFile(file.path))
    .map((file, index) => ({
      file,
      index,
      score: scoreFileForPrompt(file, keywords),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.file)

  const topKeywordFiles = rankedNonCoreFiles.slice(0, FILE_SELECTION_LIMIT)

  const dependencyExpanded = collectDependencyFiles(
    dedupedFiles,
    [...coreFiles, ...topKeywordFiles]
  )

  return dedupeFilesByPath(dependencyExpanded).slice(0, FILE_SELECTION_LIMIT * 2)
}

function selectFollowUpFiles(existingFiles: ProjectFileInput[], prompt: string): ProjectFileInput[] {
  const dedupedFiles = dedupeFilesByPath(existingFiles)
  const coreFiles = dedupedFiles.filter((f) => isCoreContextFile(f.path))
  const otherFiles = dedupedFiles.filter((f) => !isCoreContextFile(f.path))
  // Core files always lead. Non-core files ordered by ascending content size so the maximum
  // number of distinct files fits within the budget — the model reasons over scope, not the scorer.
  const ordered = [...coreFiles, ...otherFiles.sort((a, b) => a.content.length - b.content.length)]
  let used = prompt.length
  const result: ProjectFileInput[] = []
  for (const file of ordered) {
    const size = file.path.length + file.content.length + 50
    if (used + size > MAX_FOLLOWUP_FILE_CONTEXT_CHARS) break
    result.push(file)
    used += size
  }
  return result
}

function isOpenSourceNvidiaModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase()
  return OPEN_SOURCE_MODEL_PATTERNS.some((pattern) => normalized.includes(pattern))
}

async function getNvidiaModels(): Promise<string[]> {
  const now = Date.now()
  if (cachedNvidiaModels && cachedNvidiaModels.expiresAt > now) {
    return cachedNvidiaModels.models
  }

  const fallbackModels = [...CURATED_NVIDIA_MODELS].sort((a, b) => a.localeCompare(b))
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY
  if (!apiKey) {
    cachedNvidiaModels = { models: fallbackModels, expiresAt: now + 5 * 60 * 1000 }
    return fallbackModels
  }

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`NVIDIA models request failed with ${response.status}`)
    }

    const data = await response.json() as { data?: Array<{ id?: string }> }
    const discoveredModels = (data.data || [])
      .map((entry) => entry.id?.trim())
      .filter((id): id is string => Boolean(id && isOpenSourceNvidiaModel(id)))

    const mergedModels = Array.from(new Set([...CURATED_NVIDIA_MODELS, ...discoveredModels]))
      .sort((a, b) => a.localeCompare(b))

    cachedNvidiaModels = { models: mergedModels, expiresAt: now + 10 * 60 * 1000 }
    return mergedModels
  } catch (error) {
    console.error("Failed to load NVIDIA models:", error)
    cachedNvidiaModels = { models: fallbackModels, expiresAt: now + 5 * 60 * 1000 }
    return fallbackModels
  }
}

// Free-tier ceiling: a strong open coding model, dynamically substituted
// server-side so no client-supplied model/provider can reach a paid provider.
const FREE_TIER_DEFAULT_MODEL = "qwen/qwen2.5-coder-32b-instruct"

async function resolveModel(model: string, requestedProvider: Provider | undefined, isPaidUser: boolean): Promise<ResolvedModel> {
  if (!isPaidUser) {
    const nvidiaModels = await getNvidiaModels()
    const target = nvidiaModels.includes(model) ? model : FREE_TIER_DEFAULT_MODEL
    return {
      client: nvidia,
      selectedModel: target,
      provider: "nvidia" as const,
    }
  }

  if (requestedProvider === "openai") {
    if (!OPENAI_MODEL_MAP[model]) {
      throw new GenerateHttpError(400, "unsupported_model", "The requested OpenAI model is not supported.")
    }
    return {
      client: openai,
      selectedModel: OPENAI_MODEL_MAP[model],
      provider: "openai" as const,
    }
  }

  if (requestedProvider === "anthropic") {
    if (!ANTHROPIC_MODEL_MAP[model]) {
      throw new GenerateHttpError(400, "unsupported_model", "The requested Claude model is not supported.")
    }
    const client = getAnthropicClient()
    if (!client) {
      throw new GenerateHttpError(503, "provider_not_configured", "Claude generation is not configured.")
    }
    return {
      client,
      selectedModel: ANTHROPIC_MODEL_MAP[model],
      provider: "anthropic" as const,
    }
  }

  if (requestedProvider === "nvidia") {
    const nvidiaModels = await getNvidiaModels()
    if (!nvidiaModels.includes(model)) {
      throw new GenerateHttpError(400, "unsupported_model", "The requested NVIDIA model is not supported.")
    }
    return {
      client: nvidia,
      selectedModel: model,
      provider: "nvidia" as const,
    }
  }

  if (OPENAI_MODEL_MAP[model]) {
    return {
      client: openai,
      selectedModel: OPENAI_MODEL_MAP[model],
      provider: "openai" as const,
    }
  }

  if (ANTHROPIC_MODEL_MAP[model]) {
    const client = getAnthropicClient()
    if (!client) {
      throw new GenerateHttpError(503, "provider_not_configured", "Claude generation is not configured.")
    }
    return {
      client,
      selectedModel: ANTHROPIC_MODEL_MAP[model],
      provider: "anthropic" as const,
    }
  }

  const nvidiaModels = await getNvidiaModels()
  if (nvidiaModels.includes(model)) {
    return {
      client: nvidia,
      selectedModel: model,
      provider: "nvidia" as const,
    }
  }

  throw new GenerateHttpError(400, "unsupported_model", "The requested model is not supported.")
}

function getFirstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function getPeriodEndDate(raw: unknown): Date | null {
  if (!raw) return null
  if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof (raw as { toDate: () => Date }).toDate === "function") {
    return (raw as { toDate: () => Date }).toDate()
  }
  const d = new Date(raw as string | number)
  return isNaN(d.getTime()) ? null : d
}

function parseFileBlocks(content: string): ParsedFileBlock[] {
  const files: ParsedFileBlock[] = []
  // Tempered pattern: a block's content can never contain another ===FILE: marker,
  // so an unterminated truncated block cannot match or swallow a re-emitted complete copy.
  const fileRegex = /===FILE:\s*(.*?)===((?:(?!===FILE:)[\s\S])*?)===END_FILE===/g
  let match: RegExpExecArray | null

  while ((match = fileRegex.exec(content)) !== null) {
    const path = normalizeRelativeFilePath(match[1].trim())
    const fileContent = match[2]
      .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim()

    if (path && !isSensitiveFilePath(path)) {
      files.push({ path, content: fileContent })
    }
  }

  return files
}

// When a generation hits the output token cap mid-file, strip the unterminated
// trailing ===FILE: block so the continuation request can re-emit it completely.
function splitTruncatedFileTail(content: string): { content: string; cutOffPath: string } {
  const lastFileIdx = content.lastIndexOf("===FILE:")
  const lastEndIdx = content.lastIndexOf("===END_FILE===")
  if (lastFileIdx === -1 || lastFileIdx <= lastEndIdx) {
    return { content, cutOffPath: "" }
  }
  const cutOffPath = content.slice(lastFileIdx).match(/^===FILE:\s*(.*?)===/)?.[1]?.trim() || ""
  return { content: content.slice(0, lastFileIdx), cutOffPath }
}

function buildContinuationInstruction(cutOffPath: string) {
  return [
    "Your previous response was cut off because it hit the output length limit. Continue the same response.",
    "- Do NOT repeat any file that already ended with ===END_FILE===.",
    cutOffPath
      ? `- The file "${cutOffPath}" was cut off mid-output. Re-emit it COMPLETELY, starting again from its ===FILE: ${cutOffPath}=== line through its ===END_FILE===.`
      : "",
    "- Then emit any files you had not started yet.",
    "- Output ONLY file blocks in the ===FILE: path=== ... ===END_FILE=== format. No other text.",
  ].filter(Boolean).join("\n")
}

function serializeFileBlocks(files: ParsedFileBlock[]) {
  return files.map((file) => `===FILE: ${file.path}===\n${file.content}\n===END_FILE===`).join("\n")
}

function getAgentMessageBlock(content: string) {
  return content.match(/===AGENT_MESSAGE===[\s\S]*?===END_AGENT_MESSAGE===\s*/)?.[0] ?? ""
}

function serializeGeneratorOutput(agentMessage: string, files: ParsedFileBlock[]) {
  const fileBlocks = serializeFileBlocks(files)
  if (!agentMessage) return fileBlocks
  return `${agentMessage.trimEnd()}\n${fileBlocks}`
}

function mergeFilesByPath(baseFiles: GeneratedProjectFile[], updateFiles: GeneratedProjectFile[]) {
  const byPath = new Map<string, GeneratedProjectFile>()
  for (const file of baseFiles) {
    if (typeof file?.path === "string" && typeof file.content === "string") {
      byPath.set(file.path, file)
    }
  }
  for (const file of updateFiles) {
    if (typeof file?.path === "string" && typeof file.content === "string") {
      byPath.set(file.path, file)
    }
  }
  return Array.from(byPath.values())
}

function getChangedFiles(beforeFiles: GeneratedProjectFile[], afterFiles: GeneratedProjectFile[]) {
  const beforeByPath = new Map(beforeFiles.map((file) => [file.path, file.content]))
  return afterFiles.filter((file) => beforeByPath.get(file.path) !== file.content)
}

function assertValidFileBlockOutput(content: string) {
  if (!content.includes("===FILE:")) {
    throw new Error("Invalid generator output: no file blocks")
  }

  const fileBlocks = parseFileBlocks(content)
  if (fileBlocks.length === 0) {
    throw new Error("Invalid generator output: no parseable file blocks")
  }

  return fileBlocks
}

function buildGenerationRepairPrompt(issues: string[], brokenContent?: string, platform: ProjectPlatform = "web") {
  if (platform === "mobile") {
    return `Repair the Expo / React Native project output and return a fully corrected response in the exact required file streaming format.

Detected issues:
${issues.map((issue) => `- ${issue}`).join("\n")}
${brokenContent ? `\nBroken output:\n${brokenContent}\n` : ""}
Rules:
- Keep the same product request, app intent, and design direction.
- Ensure package.json, app.json, App.tsx, babel.config.js, and tailwind.config.js are present for new mobile apps.
- package.json must use Expo SDK ${MOBILE_EXPO_DEPENDENCIES.expo}, react ${MOBILE_EXPO_DEPENDENCIES.react}, and react-native ${MOBILE_EXPO_DEPENDENCIES["react-native"]}.
- Remove any web-only files or dependencies: vite.config, index.html, src/main.tsx, src/index.css, postcss.config, vite, @vitejs/plugin-react, react-dom.
- Use React Native and Expo only.
- Fix all missing imports, missing components, missing assets, and missing package dependencies.
- Do not explain the fixes.
- Return exactly one AGENT_MESSAGE and corrected file blocks only.
- Do not wrap files in JSON or markdown.`
  }

  return `Repair the project output and return a fully corrected response in the exact required file streaming format.

Detected issues:
${issues.map((issue) => `- ${issue}`).join("\n")}
${brokenContent ? `\nBroken output:\n${brokenContent}\n` : ""}
Rules:
- Keep the same product request, app intent, and design direction.
- Ensure package.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/index.css, tailwind.config.ts, and postcss.config.js are present for new apps.
- Ensure src/main.tsx imports './index.css'.
- Fix all missing imports, missing components, missing assets, and missing package dependencies.
- Do not explain the fixes.
- Return exactly one AGENT_MESSAGE and corrected file blocks only.
- Do not wrap files in JSON or markdown.`
}

function validateGeneratedFiles(
  generatedContent: string,
  existingFiles?: { path: string; content: string }[],
  platform: ProjectPlatform = "web"
) {
  const fileBlocks = parseFileBlocks(generatedContent)
  const validation = validateGeneratedProjectFiles(fileBlocks, {
    existingFiles,
    requireNewAppScaffold: !existingFiles?.length,
    platform,
  })

  return {
    fileBlocks,
    issues: validation.issueMessages,
  }
}

function injectMissingCssFiles(fileBlocks: ParsedFileBlock[], platform: ProjectPlatform = "web"): ParsedFileBlock[] {
  return ensureGeneratedProjectScaffold(fileBlocks, platform)
}

function filterFilesForPlatform<T extends { path: string }>(files: T[], platform: ProjectPlatform): T[] {
  if (platform !== "mobile") return files
  return files.filter((file) => !isForbiddenMobileWebFilePath(file.path))
}

async function generateWithNvidiaValidation(params: {
  client: OpenAI
  selectedModel: string
  systemPrompt: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  platform: ProjectPlatform
  maxOutputTokens: number
  temperature?: number
}) {
  const initial = await params.client.chat.completions.create({
    model: params.selectedModel,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessageContent },
    ],
    max_tokens: params.maxOutputTokens,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
  })

  let finalContent = initial.choices[0]?.message?.content || ""
  let usageInfo: any = initial.usage || null

  // One continuation round if the model hit the output token cap mid-response:
  // strip the unterminated trailing file block and ask it to resume, re-emitting
  // the cut-off file completely. On failure, fall through — downstream
  // validation/repair handles whatever we have.
  if (initial.choices[0]?.finish_reason === "length") {
    try {
      const { content: cleanContent, cutOffPath } = splitTruncatedFileTail(finalContent)
      finalContent = cleanContent

      const continued = await params.client.chat.completions.create({
        model: params.selectedModel,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessageContent },
          { role: "assistant", content: finalContent },
          { role: "user", content: buildContinuationInstruction(cutOffPath) },
        ],
        max_tokens: params.maxOutputTokens,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      })

      finalContent += continued.choices[0]?.message?.content || ""
      usageInfo = mergeUsageInfo(usageInfo, continued.usage)
    } catch (err) {
      console.error("NVIDIA generation continuation failed:", err)
    }
  }

  try {
    assertValidFileBlockOutput(finalContent)
  } catch {
    const retried = await params.client.chat.completions.create({
      model: params.selectedModel,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: finalContent },
        { role: "user", content: STRICT_FILE_FORMAT_RETRY_PROMPT },
      ],
      max_tokens: params.maxOutputTokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    })

    finalContent = retried.choices[0]?.message?.content || ""
    usageInfo = mergeUsageInfo(usageInfo, retried.usage)
    assertValidFileBlockOutput(finalContent)
  }

  let validation = validateGeneratedFiles(finalContent, params.existingFiles, params.platform)

  if (validation.issues.length > 0) {
    const repairPrompt = buildGenerationRepairPrompt(validation.issues, undefined, params.platform)

    const repaired = await params.client.chat.completions.create({
      model: params.selectedModel,
      messages: [
        { role: "system", content: `${params.systemPrompt}\n\nYou must repair invalid output when issues are reported.` },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: finalContent },
        { role: "user", content: repairPrompt },
      ],
      max_tokens: params.maxOutputTokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    })

    finalContent = repaired.choices[0]?.message?.content || finalContent
    usageInfo = mergeUsageInfo(usageInfo, repaired.usage)
    validation = validateGeneratedFiles(finalContent, params.existingFiles, params.platform)
  }

  let finalFileBlocks = filterFilesForPlatform(validation.fileBlocks, params.platform)
  const agentMessage = getAgentMessageBlock(finalContent)
  const beforeScaffold = mergeFilesByPath(params.existingFiles ?? [], finalFileBlocks)
  const afterScaffold = injectMissingCssFiles(beforeScaffold, params.platform)
  const scaffoldChanges = getChangedFiles(beforeScaffold, afterScaffold)
  finalFileBlocks = mergeFilesByPath(finalFileBlocks, scaffoldChanges)

  finalFileBlocks = normalizeGeneratedCodeFiles(finalFileBlocks)
  finalContent = serializeGeneratorOutput(agentMessage, finalFileBlocks)
  validation = validateGeneratedFiles(finalContent, params.existingFiles, params.platform)

  return {
    finalContent,
    usageInfo,
    streamedLength: finalContent.length,
    remainingIssues: validation.issues,
  }
}

// Distinct aesthetic territories. One is randomly sampled per generation so the same
// prompt never converges on the same design. The creative director interprets the chosen
// vector in the context of the actual prompt — a "brutalist bakery" is still a bakery,
// not a generic brutalist template.
const AESTHETIC_VECTORS = [
  "editorial/magazine: dramatically oversized display type (100px+), generous asymmetric whitespace, image used as editorial photography not hero banner, text anchors composition",
  "swiss grid: strict mathematical column grid, typographic hierarchy as the sole decoration, near-monochrome palette with one precise accent, every element has a grid reason",
  "brutalist/raw: exposed structural elements, extreme weight contrast in type, unconventional layout that breaks expected patterns, high contrast black/white with one saturated accent",
  "nordic restraint: extreme negative space, muted organic palette (stone/birch/slate), humanist serif body type, sections breathe — padding doubles what feels comfortable",
  "editorial dark/luxury: rich near-black background, warm champagne or cream type, restrained single accent, premium vocabulary — no gradients, no glow, just weight and tone",
  "artisan/craft: warm earth palette derived from the product's material or origin, tactile texture via CSS, handwritten or high-contrast serif display, storytelling-first section order",
  "precision/technical: monospace type as accent, data-forward layout with numbers as visual anchors, cool neutral palette, grid-defined spacing, information density as a feature",
  "mediterranean warmth: rich terracotta/ochre/fig palette, generous padding, sensory copy that references texture and smell, full-bleed background tones shift from warm to warm-dark",
  "japanese refinement: asymmetric negative space used intentionally, one restrained accent color maximum, typography as the only decoration, intervals of true emptiness between elements",
  "art deco revival: structured symmetry with geometric ornament as CSS shapes, high-contrast palette (black/cream/gold or black/cream/rust), period-appropriate display typeface, horizontal ruled lines as dividers",
] as const

function sampleAestheticVector(): string {
  return AESTHETIC_VECTORS[Math.floor(Math.random() * AESTHETIC_VECTORS.length)]
}

// Derives a specific design brief from the user's prompt before generation.
// A randomly sampled aesthetic vector forces genuine creative variance — the same
// prompt will produce a different visual direction on each run.
async function deriveDesignBrief(prompt: string): Promise<string> {
  const aestheticVector = sampleAestheticVector()
  try {
    const res = await openai.chat.completions.create({
      model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
      messages: [
        {
          role: "system",
          content: `You are the creative director at a world-class digital agency (Pentagram, Fantasy Interactive, Instrument, Huge). Your job is to produce a committed, specific design brief that will make the AI developer generate a genuinely distinctive website — one that could not have been produced by any other AI tool.

MANDATORY AESTHETIC VECTOR — you must work within this creative territory:
"${aestheticVector}"
Interpret this vector through the lens of the client's actual domain and business context. A brutalist bakery is still a bakery — the vector shapes how you present it, not what it is.

STEP 1 — DOMAIN ANALYSIS (think silently before writing anything):
- What industry/domain is this? Who are their customers and what do those customers already trust?
- What is the best-designed real website in this exact niche? (e.g. for a law firm: Debevoise; for a bakery: Tartine; for a SaaS: Linear, Vercel, Craft)
- What visual language does that reference use? (type scale, palette, whitespace, image style)
- What layout patterns does this domain actually use in the real world that no generic AI template would know? (e.g. a fishmonger lists catch by weight, a wine bar lists bottles by region not price, a gym lists class types not "our services")
- What would make THIS specific business look immediately credible to someone who knows the industry?

STEP 2 — WRITE THE BRIEF. Be specific. Vague is not allowed.
- NOT: "warm tones" → MUST: "#f2ede4 background, #b8652a accent, #1a1612 text"
- NOT: "large hero" → MUST: "full-bleed #0f0f0e bg, 108px Playfair Display italic left-aligned, max 6 words, no subheadline, single ghost-border button bottom-left corner"
- NOT: "clean layout" → MUST: "two-column grid: large stat/number left (120px bold), short descriptor right (14px/1.6), 5 rows"

CRITICAL CONSTRAINT:
- No gradient hero. No centered headline + subheadline + two buttons. No three identical feature cards. No "Why Choose Us". No testimonial card grid.
- The site must be immediately readable as this specific brand in this specific industry — not as "a website".
- At least one section must use a structural device no AI tool would default to: a large editorial number as section anchor, a full-bleed split screen, a horizontal scroll strip, a table-style service list, or a typographic-only hero with no imagery.

Output EXACTLY this structure (plain text, no markdown headers, no bullet points outside the SECTIONS and LAYOUT_VOCABULARY lists):
PALETTE: [bg hex] [primary-text hex] [accent hex] [muted-surface hex] [border hex]
FONTS: [display font name, Google Fonts] / [body font name, Google Fonts]
PERSONALITY: [adjective 1], [adjective 2], [adjective 3]
VISUAL_REFERENCE: [1-2 specific real websites, e.g. "Linear.app (tight grid, monospace accents) and Craft.do (generous whitespace)"]
HERO_FORMAT: [exact: bg color hex, display type size in px, alignment, max headline word count, subheadline yes/no, CTA style and screen position, image yes/no and treatment]
HERO_HEADLINE: [the actual written headline — punchy, specific, under 8 words, sounds like the brand owner wrote it]
SECTIONS: [ordered list — each entry: SectionName: exact layout description (columns, anchoring element, type treatment, what makes it non-generic)]
TYPOGRAPHY_APPROACH: [display size range, label style treatment, body size and line-height, any mixed-weight or mixed-case techniques]
STANDOUT: [one concrete unexpected layout or composition decision implementable in React/Tailwind — be specific about the implementation]
LAYOUT_VOCABULARY: [2-3 domain-specific layout or content patterns for this exact business type that a generic template would never include — derive from how this industry actually presents information in the real world]
ANTI_PATTERN: [describe in one sentence the exact generic AI version of this site — the one we must not produce]`,
        },
        {
          role: "user",
          content: prompt.slice(0, 3000),
        },
      ],
      max_completion_tokens: 1400,
      temperature: 0.75,
    })
    return res.choices[0]?.message?.content?.trim() || ""
  } catch {
    return ""
  }
}

async function salvageWithOpenAI(params: {
  systemPrompt: string
  userMessageContent: string
  brokenContent: string
  issues: string[]
  platform: ProjectPlatform
  maxOutputTokens: number
}) {
  const salvagePrompt = buildGenerationRepairPrompt(params.issues, params.brokenContent, params.platform)

  const repaired = await openai.chat.completions.create({
    model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    messages: [
      { role: "system", content: `${params.systemPrompt}\n\nYou are repairing an invalid project output into a buildable final result.` },
      { role: "user", content: params.userMessageContent },
      { role: "user", content: salvagePrompt },
    ],
    max_completion_tokens: params.maxOutputTokens,
  })

  let content = repaired.choices[0]?.message?.content || params.brokenContent
  
  const agentMessage = getAgentMessageBlock(content)
  const parsedBlocks = filterFilesForPlatform(parseFileBlocks(content), params.platform)
  const fileBlocks = normalizeGeneratedCodeFiles(injectMissingCssFiles(parsedBlocks, params.platform))
  content = serializeGeneratorOutput(agentMessage, fileBlocks)

  return {
    content,
    usage: repaired.usage || null,
  }
}

async function repairInvalidFileFormatWithOpenAI(params: {
  systemPrompt: string
  userMessageContent: string
  brokenContent: string
  maxOutputTokens: number
}) {
  const repaired = await openai.chat.completions.create({
    model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessageContent },
      { role: "assistant", content: params.brokenContent },
      { role: "user", content: STRICT_FILE_FORMAT_RETRY_PROMPT },
    ],
    max_completion_tokens: params.maxOutputTokens,
  })

  const content = repaired.choices[0]?.message?.content || ""
  assertValidFileBlockOutput(content)

  return {
    content,
    usage: repaired.usage || null,
  }
}

async function streamAnthropicCompletion(params: {
  client: Anthropic
  selectedModel: string
  systemPrompt: string
  /** Per-request system content (e.g. design brief); appended after the cached static prompt. */
  systemPromptDynamic: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  state: StreamState
  platform: ProjectPlatform
  maxOutputTokens: number
  temperature?: number
  promptCachePlan: PromptCachePlan
}) {
  const emitIncremental = params.platform !== "mobile"

  // Only the static system prompt is eligible for cache_control — never per-user
  // content. The per-request dynamic suffix (design brief) is a separate,
  // uncached block AFTER the breakpoint so the cached prefix stays byte-stable.
  const systemContent: TextBlockParam[] = [
    params.promptCachePlan.cacheClaudeSystemPrompt && params.promptCachePlan.claudeCacheControl
      ? { type: "text" as const, text: params.systemPrompt, cache_control: params.promptCachePlan.claudeCacheControl }
      : { type: "text" as const, text: params.systemPrompt },
    ...(params.systemPromptDynamic
      ? [{ type: "text" as const, text: params.systemPromptDynamic }]
      : []),
  ]

  const buildMessages = (priorAssistant?: string, continuationInstruction?: string): MessageParam[] => {
    const messages: MessageParam[] = [{ role: "user", content: params.userMessageContent }]
    if (priorAssistant) {
      messages.push({ role: "assistant", content: priorAssistant })
      if (continuationInstruction) {
        messages.push({ role: "user", content: continuationInstruction })
      }
    }
    return messages
  }

  const runAnthropicStream = async (messages: MessageParam[]) => {
    const stream = await params.client.messages.create({
      model: params.selectedModel,
      max_tokens: params.maxOutputTokens,
      system: systemContent,
      messages,
      stream: true as const,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    })

    let buffered = ""
    let stopReason: string | null = null
    let partialUsage: AnthropicUsage | null = null

    for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
      if (event.type === "message_start") {
        partialUsage = event.message.usage as AnthropicUsage
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        buffered += event.delta.text
        if (emitIncremental && !params.state.closed) {
          try { params.controller.enqueue(params.encoder.encode(event.delta.text)) }
          catch { params.state.closed = true }
        }
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason ?? null
        if (partialUsage != null && event.usage?.output_tokens != null) {
          partialUsage = Object.assign({}, partialUsage, { output_tokens: event.usage.output_tokens }) as AnthropicUsage
        }
      }
    }

    return { buffered, stopReason, partialUsage }
  }

  let firstResult = await runAnthropicStream(buildMessages())
  let output = firstResult.buffered
  let stopReason = firstResult.stopReason
  let totalUsage: AnthropicUsage | null = firstResult.partialUsage
  let continuationRounds = 0

  while (stopReason === "max_tokens" && continuationRounds < MAX_CONTINUATION_ROUNDS) {
    continuationRounds++
    try {
      const { content: cleanOutput, cutOffPath } = splitTruncatedFileTail(output)
      output = cleanOutput
      const continued = await runAnthropicStream(buildMessages(output, buildContinuationInstruction(cutOffPath)))
      output += continued.buffered
      stopReason = continued.stopReason
      totalUsage = addAnthropicUsage(totalUsage, continued.partialUsage)
    } catch (err) {
      logGenerationError({ phase: "anthropic_continuation", provider: "anthropic" }, err)
      break
    }
  }

  params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, normalizeAnthropicUsage(totalUsage))
  params.state.streamedLength += output.length

  const parsedBlocks = filterFilesForPlatform(parseFileBlocks(output), params.platform)
  const beforeScaffold = mergeFilesByPath(params.existingFiles ?? [], parsedBlocks)
  const afterScaffold = injectMissingCssFiles(beforeScaffold, params.platform)
  const scaffoldChanges = normalizeGeneratedCodeFiles(getChangedFiles(beforeScaffold, afterScaffold))
  let finalBlocks = mergeFilesByPath(parsedBlocks, scaffoldChanges)

  if (emitIncremental && scaffoldChanges.length && !params.state.closed) {
    const scaffoldPayload = serializeFileBlocks(scaffoldChanges)
    try {
      params.controller.enqueue(params.encoder.encode(scaffoldPayload))
      params.state.streamedLength += scaffoldPayload.length
    } catch {
      params.state.closed = true
    }
  }

  if (!emitIncremental && !params.state.closed) {
    const agentMessage = getAgentMessageBlock(output)
    const finalContent = serializeGeneratorOutput(agentMessage, finalBlocks)
    params.controller.enqueue(params.encoder.encode(finalContent))
    params.state.streamedLength = finalContent.length
  }
}

async function streamWithResolvedProvider(params: {
  client: OpenAI | Anthropic
  provider: Provider
  selectedModel: string
  systemPrompt: string
  /** Per-request system content (e.g. design brief); appended after the static prompt. */
  systemPromptDynamic: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  state: StreamState
  platform: ProjectPlatform
  maxOutputTokens: number
  temperature?: number
  promptCachePlan: PromptCachePlan
}) {
  // OpenAI/NVIDIA take one system string: static prefix first, dynamic suffix
  // last — OpenAI's automatic prompt cache matches on the longest common
  // message prefix, so the stable content must lead.
  const fullSystemPrompt = params.systemPromptDynamic
    ? `${params.systemPrompt}${params.systemPromptDynamic}`
    : params.systemPrompt

  if (params.provider === "nvidia") {
    const validated = await generateWithNvidiaValidation({
      client: params.client as OpenAI,
      selectedModel: params.selectedModel,
      systemPrompt: fullSystemPrompt,
      userMessageContent: params.userMessageContent,
      existingFiles: params.existingFiles,
      platform: params.platform,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
    })
    params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, validated.usageInfo)
    params.state.streamedLength = validated.streamedLength
    try {
      assertValidFileBlockOutput(validated.finalContent)
    } catch {
      const repaired = await repairInvalidFileFormatWithOpenAI({
        systemPrompt: fullSystemPrompt,
        userMessageContent: params.userMessageContent,
        brokenContent: validated.finalContent,
        maxOutputTokens: params.maxOutputTokens,
      })
      params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, repaired.usage)
      params.state.streamedLength = repaired.content.length
      params.controller.enqueue(params.encoder.encode(repaired.content))
      return
    }

    if (validated.remainingIssues.length > 0) {
      console.warn("NVIDIA generation still has unresolved validation issues:", validated.remainingIssues)
      const salvaged = await salvageWithOpenAI({
        systemPrompt: fullSystemPrompt,
        userMessageContent: params.userMessageContent,
        brokenContent: validated.finalContent,
        issues: validated.remainingIssues,
        platform: params.platform,
        maxOutputTokens: params.maxOutputTokens,
      })
      assertValidFileBlockOutput(salvaged.content)
      params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, salvaged.usage)
      params.state.streamedLength = salvaged.content.length
      params.controller.enqueue(params.encoder.encode(salvaged.content))
    } else {
      params.controller.enqueue(params.encoder.encode(validated.finalContent))
    }
    return
  }

  if (params.provider === "anthropic") {
    await streamAnthropicCompletion({
      client: params.client as Anthropic,
      selectedModel: params.selectedModel,
      systemPrompt: params.systemPrompt,
      systemPromptDynamic: params.systemPromptDynamic,
      userMessageContent: params.userMessageContent,
      existingFiles: params.existingFiles,
      controller: params.controller,
      encoder: params.encoder,
      state: params.state,
      platform: params.platform,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
      promptCachePlan: params.promptCachePlan,
    })
    return
  }

  const createOpenAICompletion = async (messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) => {
    const controllerAbort = new AbortController()
    const timeoutId = setTimeout(() => {
      controllerAbort.abort()
    }, OPENAI_TIMEOUT_MS)

    try {
      // OpenAI prompt caching is automatic for supported models (GPT-4o, GPT-4.1, o-series).
      // The cache is keyed on the longest common message prefix — keeping a stable system prompt
      // at position 0 is the correct and only required practice. No explicit cache params exist.
      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
        model: params.selectedModel,
        stream: true,
        messages,
        max_completion_tokens: params.maxOutputTokens,
        stream_options: { include_usage: true } as any,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      }
      const completion = await (params.client as OpenAI).chat.completions.create(requestParams, { signal: controllerAbort.signal })
      clearTimeout(timeoutId)
      return completion
    } catch (err: any) {
      clearTimeout(timeoutId)

      if (err?.name === "AbortError") {
        console.error("OpenAI request aborted due to timeout")
        throw new Error("MODEL_TIMEOUT")
      }

      throw err
    }
  }

  const emitIncremental = params.platform !== "mobile"

  const streamTokens = async (completion: Awaited<ReturnType<typeof createOpenAICompletion>>) => {
    let buffered = ""
    let finishReason: string | null = null
    for await (const chunk of completion) {
      if ((chunk as any).usage) params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, (chunk as any).usage)
      const chunkFinishReason = chunk.choices?.[0]?.finish_reason
      if (chunkFinishReason) finishReason = chunkFinishReason
      const content = chunk.choices?.[0]?.delta?.content
      if (!content) continue
      buffered += content
      if (emitIncremental && !params.state.closed) {
        try { params.controller.enqueue(params.encoder.encode(content)) }
        catch { params.state.closed = true }
      }
    }
    return { buffered, finishReason }
  }

  let basePrompt = params.userMessageContent
  if (params.userMessageContent.includes("\n\nCurrent project files")) {
    basePrompt = params.userMessageContent.split("\n\nCurrent project files")[0]
  }

  let completion
  try {
    completion = await createOpenAICompletion([
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: params.userMessageContent },
    ])
  } catch (err: any) {
    if (err?.message === "MODEL_TIMEOUT" && params.existingFiles?.length) {
      const retrySeedFiles = selectRelevantFiles(params.existingFiles, params.userMessageContent)
      const reducedFiles = trimPromptFilesToBudget(
        params.userMessageContent,
        retrySeedFiles.slice(0, Math.max(2, Math.ceil(retrySeedFiles.length / 2)))
      )
      completion = await createOpenAICompletion([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: buildFollowUpUserMessage(basePrompt, reducedFiles) },
      ])
    } else {
      throw err
    }
  }

  const firstPass = await streamTokens(completion)
  let output = firstPass.buffered
  let finishReason = firstPass.finishReason

  // Continuation: the model hit the output token cap mid-response. Strip the
  // unterminated trailing file block and ask it to resume, re-emitting the
  // cut-off file completely. The tempered parse regex guarantees the dead
  // truncated tail already streamed to the client can never match.
  let continuationRounds = 0
  while (finishReason === "length" && continuationRounds < MAX_CONTINUATION_ROUNDS) {
    continuationRounds++
    try {
      const { content: cleanOutput, cutOffPath } = splitTruncatedFileTail(output)
      output = cleanOutput

      const continuation = await createOpenAICompletion([
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: output },
        { role: "user", content: buildContinuationInstruction(cutOffPath) },
      ])
      const continued = await streamTokens(continuation)
      output += continued.buffered
      finishReason = continued.finishReason
    } catch (err) {
      console.error("Generation continuation failed:", err)
      break
    }
  }

  params.state.streamedLength += output.length

  const parsedBlocks = filterFilesForPlatform(parseFileBlocks(output), params.platform)
  const beforeScaffold = mergeFilesByPath(params.existingFiles ?? [], parsedBlocks)
  const afterScaffold = injectMissingCssFiles(beforeScaffold, params.platform)
  const scaffoldChanges = normalizeGeneratedCodeFiles(getChangedFiles(beforeScaffold, afterScaffold))
  let finalBlocks = mergeFilesByPath(parsedBlocks, scaffoldChanges)

  if (emitIncremental && scaffoldChanges.length && !params.state.closed) {
    const scaffoldPayload = serializeFileBlocks(scaffoldChanges)
    try {
      params.controller.enqueue(params.encoder.encode(scaffoldPayload))
      params.state.streamedLength += scaffoldPayload.length
    } catch {
      params.state.closed = true
    }
  }

  let validation = validateGeneratedFiles(serializeFileBlocks(finalBlocks), params.existingFiles, params.platform)
  if (validation.issues.length > 0 && !params.state.closed) {
    console.warn("OpenAI generation has validation issues, attempting salvage:", validation.issues)
    const salvaged = await salvageWithOpenAI({
      systemPrompt: fullSystemPrompt,
      userMessageContent: params.userMessageContent,
      brokenContent: serializeFileBlocks(finalBlocks),
      issues: validation.issues,
      platform: params.platform,
      maxOutputTokens: params.maxOutputTokens,
    })
    const salvagedBlocks = normalizeGeneratedCodeFiles(filterFilesForPlatform(parseFileBlocks(salvaged.content), params.platform))
    if (salvagedBlocks.length) {
      const beforeSalvage = mergeFilesByPath(params.existingFiles ?? [], finalBlocks)
      const afterSalvage = mergeFilesByPath(beforeSalvage, salvagedBlocks)
      const salvageChanges = getChangedFiles(beforeSalvage, afterSalvage)
      const salvagePayload = serializeFileBlocks(salvageChanges.length ? salvageChanges : salvagedBlocks)
      if (emitIncremental) {
        try {
          params.controller.enqueue(params.encoder.encode(salvagePayload))
          params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, salvaged.usage)
          params.state.streamedLength += salvagePayload.length
        }
        catch { params.state.closed = true }
      } else {
        params.state.usageInfo = mergeUsageInfo(params.state.usageInfo, salvaged.usage)
      }
      finalBlocks = mergeFilesByPath(finalBlocks, salvagedBlocks)
      validation = validateGeneratedFiles(serializeFileBlocks(finalBlocks), params.existingFiles, params.platform)
      if (validation.issues.length > 0) {
        console.warn("OpenAI salvage left unresolved validation issues:", validation.issues)
      }
    }
  }

  if (!emitIncremental && !params.state.closed) {
    const finalContent = serializeGeneratorOutput(getAgentMessageBlock(output), finalBlocks)
    params.controller.enqueue(params.encoder.encode(finalContent))
    params.state.streamedLength = finalContent.length
  }
}

async function runBuilderRuntime(params: {
  client: OpenAI | Anthropic
  provider: Provider
  selectedModel: string
  systemPrompt: string
  /** Per-request system content (e.g. design brief); appended after the static prompt. */
  systemPromptDynamic: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  state: StreamState
  platform: ProjectPlatform
  maxOutputTokens: number
  temperature?: number
  promptCachePlan: PromptCachePlan
}) {
  await streamWithResolvedProvider(params)
}

export async function GET() {
  const nvidiaModels = await getNvidiaModels()
  const anthropicModels = getAnthropicClient() ? Object.keys(ANTHROPIC_MODEL_MAP) : []
  return Response.json({
    defaultModel: DEFAULT_MODEL,
    models: [...Object.keys(OPENAI_MODEL_MAP), ...anthropicModels, ...nvidiaModels],
    // Same list resolveModel() itself checks (`nvidiaModels.includes(model)`) to
    // decide whether a free-tier request gets the requested model or falls back
    // to FREE_TIER_DEFAULT_MODEL — the single source of truth for what a free
    // plan can actually reach, not a separately-maintained allow-list.
    freeModels: nvidiaModels,
    providers: PROVIDER_CAPABILITIES,
  })
}

export async function POST(req: Request) {
  // Reject oversized payloads before JSON parsing to avoid memory exhaustion.
  const rawBody = await req.text().catch(() => null)
  if (rawBody === null) {
    return jsonError(400, "invalid_request", "Could not read request body.")
  }
  if (rawBody.length > MAX_REQUEST_BODY_CHARS) {
    return jsonError(413, "payload_too_large", "Request body exceeds the maximum allowed size.")
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch {
    return jsonError(400, "invalid_json", "Request body is not valid JSON.")
  }

  const parseResult = generateRequestSchema.safeParse(parsedJson)
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error)
  }
  const body = parseResult.data

  const {
    prompt,
    model: requestedModelName = DEFAULT_MODEL,
    provider: requestedProvider,
    idToken,
    projectId,
    existingFiles,
    intent,
    generationType = "new",
    maxTokens,
    temperature,
    promptCaching,
    idempotencyKey,
    skipDesignBrief,
    inspirationContext,
  } = body

  const safeExistingFiles = existingFiles ? dedupeFilesByPath(existingFiles) : undefined

  // Authenticate via Firebase ID token (body) or Authorization Bearer header.
  const authToken = getBearerToken(req, body)
  if (!authToken) {
    return jsonError(401, "missing_auth", "Authentication token is required.")
  }

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(authToken)
    uid = decoded.uid
  } catch {
    return jsonError(401, "invalid_auth", "Authentication token is invalid or expired.")
  }

  // Pre-flight gates are independent reads — run them concurrently instead of
  // paying three sequential Firestore round trips. Response precedence is
  // unchanged: rate limit → project access → token balance. allSettled
  // captures every rejection, so no gate can produce an unhandled rejection.
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : ""
  const [rateLimitResult, projectResult, balanceResult] = await Promise.allSettled([
    assertRateLimit({
      scope: "generate",
      key: uid,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    }),
    normalizedProjectId
      ? assertProjectCanEdit(normalizedProjectId, uid)
      : Promise.resolve(null),
    // Shared balance gate: resets the monthly period when lapsed, then requires
    // a positive balance. Same gate as /api/computer/run.
    assertTokenBalance(uid),
  ])

  if (rateLimitResult.status === "rejected") {
    const error = rateLimitResult.reason
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    throw error
  }

  let projectPlatform: ProjectPlatform = "web"
  if (normalizedProjectId) {
    if (projectResult.status === "rejected") {
      const error = projectResult.reason
      const message = error instanceof Error ? error.message : "Access denied"
      const status = message.includes("Project not found") ? 404 : message.includes("Forbidden") ? 403 : 500
      return Response.json({ error: status === 500 ? "Server error" : message }, { status })
    }
    if (projectResult.value) {
      const projectData = projectResult.value.snap.data() as { platform?: unknown }
      projectPlatform = normalizePlatform(projectData.platform)
    }
  }

  if (balanceResult.status === "rejected") {
    const e = balanceResult.reason
    if (e instanceof InsufficientTokensError) {
      return new Response(JSON.stringify({ error: 'Insufficient tokens' }), { status: 402 })
    }
    if (e instanceof MeteringUserNotFoundError) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }
    console.error('Token check failed', e)
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
  }

  const isFollowUp = Array.isArray(safeExistingFiles) && safeExistingFiles.length > 0

  // The design brief is the longest pre-stream step (a full model call). Start
  // it as soon as the auth/rate-limit/balance gates have passed so it overlaps
  // model resolution and the idempotency reservation instead of running after
  // them. deriveDesignBrief never rejects — it resolves "" on failure.
  const designBriefPromise: Promise<string> =
    isFollowUp || skipDesignBrief === true ? Promise.resolve("") : deriveDesignBrief(prompt)

  // Reuses the plan already fetched by assertTokenBalance — no extra read.
  const isPaidUser = balanceResult.value.planId !== "free"

  let resolvedModel: ResolvedModel
  try {
    resolvedModel = await resolveModel(requestedModelName, requestedProvider, isPaidUser)
  } catch (err) {
    const info = publicGenerationError(err)
    return jsonError(info.status, info.code, info.message)
  }
  const { client, selectedModel, provider } = resolvedModel

  const maxOutputTokens = maxTokens ?? GENERATION_MAX_OUTPUT_TOKENS
  const promptFiles = isFollowUp ? selectFollowUpFiles(safeExistingFiles || [], prompt) : []

  const promptCachePlan = buildPromptCachePlan({
    provider,
    selectedModel,
    platform: projectPlatform,
    generationType,
    promptCaching,
    cacheClaudeSystemPrompt: true,
  })

  let idempotencyReservation: Awaited<ReturnType<typeof reserveIdempotencyKey>> = null
  if (idempotencyKey) {
    try {
      idempotencyReservation = await reserveIdempotencyKey(uid, idempotencyKey)
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        return jsonError(err.status, err.code, err.message)
      }
      logGenerationError({ phase: "idempotency_reserve", uid }, err)
      return jsonError(500, "server_error", "Generation failed. Please try again.")
    }
  }

  const isInspiration = intent === "inspiration"
  const designBrief = await designBriefPromise
  const systemPrompt = projectPlatform === "mobile"
    ? buildMobileGenerationSystemPrompt({ isFollowUp })
    : buildWebGenerationSystemPrompt({ isFollowUp })
  const finalSystemPrompt = projectPlatform === "mobile"
    ? `${systemPrompt}\n\n${MOBILE_MODEL_RELIABILITY_PROMPT}`
    : `${systemPrompt}\n\n${WEB_MODEL_RELIABILITY_PROMPT}`
  // Per-request content (design brief + checklist) lives in a separate suffix
  // appended AFTER the static prompt: OpenAI's automatic prefix cache and the
  // Claude cache_control block both stay byte-stable across requests.
  const dynamicSystemPrompt = projectPlatform === "mobile"
    ? buildMobileDesignBriefSuffix(designBrief)
    : isFollowUp ? "" : buildWebDesignBriefSuffix(designBrief)

  // Build user message — inspiration mode prepends the reference site context.
  const inspirationMarkdown = typeof inspirationContext?.markdown === "string"
    ? inspirationContext.markdown.slice(0, 8000)
    : ""
  const inspirationPrefix = inspirationContext
    ? `REFERENCE SITE FOR INSPIRATION:\nURL: ${inspirationContext.sourceUrl}\nTitle: ${inspirationContext.title}\nDescription: ${inspirationContext.description}\n\nSite content:\n${inspirationMarkdown}\n\n${isInspiration ? "Use the above as the content and layout inspiration. Recreate the same sections, copy, and visual hierarchy as a modern React app with Tailwind. Match the design intent closely without copying styles verbatim." : "Use the above only as reference context. Build a fresh, inspired design."}\n\n`
    : ""

  const userMessageContent = isFollowUp
    ? buildFollowUpUserMessage(inspirationPrefix + prompt, promptFiles)
    : projectPlatform === "mobile"
      ? `Create an Expo + React Native + TypeScript mobile application: ${inspirationPrefix}${prompt}`
      : `Create a Vite + React + TypeScript application: ${inspirationPrefix}${prompt}`

  const encoder = new TextEncoder()
  const streamState: StreamState = {
    usageInfo: null,
    streamedLength: 0,
    closed: false,
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runBuilderRuntime({
          client,
          provider,
          selectedModel,
          systemPrompt: finalSystemPrompt,
          systemPromptDynamic: dynamicSystemPrompt,
          userMessageContent,
          existingFiles: safeExistingFiles,
          controller,
          encoder,
          state: streamState,
          platform: projectPlatform,
          maxOutputTokens,
          temperature,
          promptCachePlan,
        })

        streamState.closed = true
        try { controller.close() } catch {}

        await Promise.all([
          chargeTokensForGeneration({
            uid,
            usageInfo: streamState.usageInfo,
            promptChars: userMessageContent.length,
            completionChars: streamState.streamedLength,
            provider,
            model: selectedModel,
            // Ledger event id is the server-minted reservation id — replays of
            // the same in-flight request can't double-charge, and the
            // client-chosen idempotency key can never influence billing.
            requestId: idempotencyReservation ? `gen_${idempotencyReservation.billingEventId}` : null,
          }),
          completeIdempotencyKey(idempotencyReservation?.ref ?? null, "completed"),
        ])
      } catch (err) {
        logGenerationError({ phase: "stream", uid, provider, model: selectedModel }, err)
        await completeIdempotencyKey(idempotencyReservation?.ref ?? null, "failed")
        if (!streamState.closed) {
          try {
            controller.enqueue(encoder.encode(`\n===GENERATION_ERROR: Generation failed===`))
          } catch {}
          streamState.closed = true
          try { controller.close() } catch {}
        }
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
