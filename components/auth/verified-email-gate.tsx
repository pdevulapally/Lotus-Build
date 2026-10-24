"use client"
import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { getSafeRedirectPath } from '@/lib/auth/redirect'
import { requiresVerifiedEmail } from '@/lib/auth/verified-email-route'
export function VerifiedEmailGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const { user, loading } = useAuth()
  const mustVerify = requiresVerifiedEmail(pathname, !!user) && !user?.emailVerified
  useEffect(() => {
    if (!loading && mustVerify) router.replace(`/verify-email?redirect=${encodeURIComponent(getSafeRedirectPath(pathname + window.location.search))}`)
  }, [loading, mustVerify, pathname, router])
  if (loading || mustVerify) return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground"><p role="status">Checking your sign-in…</p></main>
  return <>{children}</>
}
