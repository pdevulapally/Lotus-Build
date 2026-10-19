const publicRouteRoots = [
  "/help",
  "/login",
  "/pricing",
  "/privacy",
  "/signup",
  "/terms",
  "/verify-email",
] as const

function isAtOrBelow(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function requiresVerifiedEmail(pathname: string, isSignedIn: boolean): boolean {
  if (!isSignedIn) return false
  if (pathname === "/") return true
  return !publicRouteRoots.some((root) => isAtOrBelow(pathname, root))
}
