import type { SandboxFile } from "@/lib/orchestrator/client"
import { normalizeRelativeFilePath } from "@/lib/security/files"

export function normalizeProjectFiles(value: unknown): SandboxFile[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const file = item as { path?: unknown; content?: unknown }
    if (typeof file.path !== "string" || typeof file.content !== "string") return []
    const path = normalizeRelativeFilePath(file.path)
    if (!path) return []
    return [{ path, content: file.content }]
  })
}
