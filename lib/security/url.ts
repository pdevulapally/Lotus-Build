const DEFAULT_LOCAL_APP_URL = "http://localhost:3000"

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/i,
]

export function getAppBaseUrl(origin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`
  }

  if (origin) return origin.replace(/\/+$/, "")
  return DEFAULT_LOCAL_APP_URL
}

export function getSameOriginUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null

  try {
    const base = new URL(baseUrl)
    const parsed = new URL(value, base)
    if (parsed.origin !== base.origin) return null
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function parsePublicHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null

  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

    const hostname = parsed.hostname.toLowerCase()
    if (!hostname || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}
