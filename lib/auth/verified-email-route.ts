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

/** Hold private pages until identity and the matching server account are known. */
export function verifiedEmailAccess(input: {
  pathname: string
  loading: boolean
  userUid: string | null
  account: { uid: string; emailVerified: boolean } | null
  accountError: string | null
}): 'allow' | 'loading' | 'verify' | 'error' {
  if (!requiresVerifiedEmail(input.pathname, true)) return 'allow'
  if (input.loading) return 'loading'
  if (input.userUid === null) return 'allow'
  if (input.accountError) return 'error'
  if (!input.account) return 'loading'
  if (input.account.uid !== input.userUid) return 'error'
  return input.account.emailVerified ? 'allow' : 'verify'
}
