const DEFAULT_AUTH_REDIRECT = "/"

// Parsing base for relative redirect candidates. Sourced from the environment
// with no fallback: a missing or invalid NEXT_PUBLIC_APP_URL fails the build
// loudly instead of silently validating against the wrong origin. The URL is
// never requested — it exists so `new URL()` can resolve relative paths and so
// escapes that change the origin are detected.
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
if (!configuredAppUrl) {
  throw new Error("NEXT_PUBLIC_APP_URL is not set — required by getSafeRedirectPath")
}
const APP_ORIGIN = new URL(configuredAppUrl).origin

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
    const parsed = new URL(candidate, APP_ORIGIN)
    if (parsed.origin !== APP_ORIGIN) return fallback
    // Discard sign-in URLs left by the withdrawn task-workspace preview.
    if (parsed.pathname === "/tasks" || parsed.pathname.startsWith("/tasks/")) return fallback
    const next = `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback
    if (next === "/login" || next.startsWith("/login?")) return fallback
    if (next === "/signup" || next.startsWith("/signup?")) return fallback
    return next
  } catch {
    return fallback
  }
}
