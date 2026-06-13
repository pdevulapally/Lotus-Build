import "server-only"

export type SandboxStatus = "queued" | "starting" | "running" | "stopping" | "failed"

export interface SandboxUrls {
  expoGo: string
  web: string
}

export interface Sandbox {
  id: string
  projectId: string
  status: SandboxStatus
  queuePosition: number | null
  subdomain: string
  urls: SandboxUrls | null
  error: string | null
  createdAt: number
  lastActivityAt: number
}

export interface SandboxFile {
  path: string
  content: string
}

export type EnsureResult =
  | { kind: "sandbox"; sandbox: Sandbox }
  | { kind: "queue_full"; message: string }

export class OrchestratorError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "OrchestratorError"
    this.status = status
    this.code = code
  }
}

const SANDBOX_STATUSES = new Set<SandboxStatus>([
  "queued",
  "starting",
  "running",
  "stopping",
  "failed",
])

function getOrchestratorConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.ORCHESTRATOR_URL?.replace(/\/$/, "")
  const apiKey = process.env.ORCHESTRATOR_API_KEY

  if (!baseUrl) {
    throw new OrchestratorError("Missing ORCHESTRATOR_URL", 500)
  }
  if (!apiKey) {
    throw new OrchestratorError("Missing ORCHESTRATOR_API_KEY", 500)
  }

  return { baseUrl, apiKey }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function parseSandboxUrls(value: unknown): SandboxUrls | null {
  if (!isRecord(value)) return null
  if (typeof value.expoGo !== "string" || typeof value.web !== "string") return null
  return { expoGo: value.expoGo, web: value.web }
}

function parseSandbox(value: unknown): Sandbox {
  if (!isRecord(value)) {
    throw new OrchestratorError("Invalid sandbox payload", 502)
  }

  const status = typeof value.status === "string" && SANDBOX_STATUSES.has(value.status as SandboxStatus)
    ? (value.status as SandboxStatus)
    : "failed"

  return {
    id: typeof value.id === "string" ? value.id : "",
    projectId: typeof value.projectId === "string" ? value.projectId : "",
    status,
    queuePosition: typeof value.queuePosition === "number" ? value.queuePosition : null,
    subdomain: typeof value.subdomain === "string" ? value.subdomain : "",
    urls: parseSandboxUrls(value.urls),
    error: typeof value.error === "string" ? value.error : null,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    lastActivityAt: typeof value.lastActivityAt === "number" ? value.lastActivityAt : Date.now(),
  }
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json()
    return isRecord(body) ? body : {}
  } catch {
    return {}
  }
}

async function orchestratorRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { baseUrl, apiKey } = getOrchestratorConfig()

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed"
    const unreachable =
      /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timed out|abort/i.test(message)

    throw new OrchestratorError(
      unreachable
        ? "Mobile preview service is unreachable. Check ORCHESTRATOR_URL is correct and the service is running."
        : `Preview service error: ${message}`,
      503,
    )
  }
}

function mapOrchestratorFailure(response: Response, body: Record<string, unknown>): never {
  const message =
    typeof body.error === "string"
      ? body.error
      : typeof body.message === "string"
        ? body.message
        : `Orchestrator request failed (${response.status})`

  throw new OrchestratorError(message, response.status, typeof body.error === "string" ? body.error : undefined)
}

export async function ensureSandbox(input: {
  projectId: string
  userId: string
  tier: "starter" | "pro" | "team"
  files?: SandboxFile[]
}): Promise<EnsureResult> {
  const response = await orchestratorRequest("/sandboxes", {
    method: "POST",
    body: JSON.stringify({
      projectId: input.projectId,
      userId: input.userId,
      tier: input.tier,
      ...(input.files?.length ? { files: input.files } : {}),
    }),
  })

  const body = await readJsonBody(response)

  if (response.status === 429) {
    return {
      kind: "queue_full",
      message: typeof body.message === "string" ? body.message : "The preview queue is full.",
    }
  }

  if (response.status === 200 || response.status === 201) {
    return {
      kind: "sandbox",
      sandbox: parseSandbox(body.sandbox),
    }
  }

  mapOrchestratorFailure(response, body)
}

export async function getSandbox(id: string): Promise<Sandbox | null> {
  const response = await orchestratorRequest(`/sandboxes/${encodeURIComponent(id)}`, {
    method: "GET",
  })

  if (response.status === 404) {
    return null
  }

  const body = await readJsonBody(response)

  if (!response.ok) {
    mapOrchestratorFailure(response, body)
  }

  return parseSandbox(body.sandbox)
}

export async function writeSandboxFiles(id: string, files: SandboxFile[]): Promise<void> {
  const response = await orchestratorRequest(`/sandboxes/${encodeURIComponent(id)}/files`, {
    method: "PUT",
    body: JSON.stringify({ files }),
  })

  const body = await readJsonBody(response)
  if (!response.ok) {
    mapOrchestratorFailure(response, body)
  }
}

export async function sandboxHeartbeat(id: string): Promise<void> {
  const response = await orchestratorRequest(`/sandboxes/${encodeURIComponent(id)}/heartbeat`, {
    method: "POST",
  })

  const body = await readJsonBody(response)
  if (!response.ok) {
    mapOrchestratorFailure(response, body)
  }
}

export async function destroySandbox(id: string): Promise<void> {
  const response = await orchestratorRequest(`/sandboxes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  const body = await readJsonBody(response)
  if (!response.ok) {
    mapOrchestratorFailure(response, body)
  }
}
