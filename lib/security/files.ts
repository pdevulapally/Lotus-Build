export function normalizeRelativeFilePath(value: unknown): string | null {
  if (typeof value !== "string") return null

  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "").trim()
  if (!normalized || normalized.includes("\0")) return null

  const parts = normalized.split("/")
  if (parts.some((part) => !part || part === "." || part === "..")) return null
  if (/^[A-Za-z]:/.test(normalized)) return null

  return normalized
}

export function isSensitiveFilePath(value: unknown): boolean {
  const path = normalizeRelativeFilePath(value)
  if (!path) return true

  const lower = path.toLowerCase()
  const name = lower.split("/").pop() || lower

  if (name === ".env" || name.startsWith(".env.")) return true
  if (name.endsWith(".pem") || name.endsWith(".key") || name.endsWith(".p12") || name.endsWith(".pfx")) return true
  if (lower.includes("service-account") || lower.includes("private-key")) return true
  if (lower.includes("/secrets/") || lower.includes("/secret/")) return true

  return false
}
