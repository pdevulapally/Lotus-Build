import type { SandboxFile } from "@/lib/orchestrator/client"

export function normalizeProjectFiles(value: unknown): SandboxFile[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const file = item as { path?: unknown; content?: unknown }
    if (typeof file.path !== "string" || typeof file.content !== "string") return []
    return [{ path: file.path, content: file.content }]
  })
}
