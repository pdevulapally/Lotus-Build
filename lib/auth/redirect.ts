const DEFAULT_AUTH_REDIRECT = "/projects"
const LOCAL_ORIGIN = "https://lotus.build"

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  const candidate = value?.trim()
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback
  }
  if (candidate.includes("\\") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate)) {
    return fallback
  }

  try {
    const parsed = new URL(candidate, LOCAL_ORIGIN)
    if (parsed.origin !== LOCAL_ORIGIN) return fallback
    const next = `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback
    if (next === "/login" || next.startsWith("/login?")) return fallback
    if (next === "/signup" || next.startsWith("/signup?")) return fallback
    return next
  } catch {
    return fallback
  }
}
