"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LogoLoader } from "@/components/ui/logo-loader"
import { useAuth } from "@/contexts/auth-context"
import { getSafeRedirectPath } from "@/lib/auth/redirect"
import { requiresVerifiedEmail } from "@/lib/auth/verified-email-route"
import { Button } from "@/components/ui/button"

function AccountLoading() {
  return <LogoLoader label="Checking your account…" theme="dark" />
}

export function VerifiedEmailGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const { user, account, loading, accountError, refreshAccount, signOut } = useAuth()
  const requiresVerification = requiresVerifiedEmail(pathname, user !== null)

  useEffect(() => {
    if (!requiresVerification || loading || !user || !account || account.emailVerified) return
    const redirect = getSafeRedirectPath(`${pathname}${window.location.search}`)
    router.replace(`/verify-email?redirect=${encodeURIComponent(redirect)}`)
  }, [account, loading, pathname, requiresVerification, router, user])

  if (!requiresVerification || !user) return <>{children}</>
  if (loading || account && !account.emailVerified || !account && !accountError) {
    return <AccountLoading />
  }
  if (accountError) {
    return (
      <main data-product-theme="dark" className="dark flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <section className="w-full max-w-sm space-y-4">
          <p role="alert" className="text-sm leading-relaxed text-muted-foreground">
            We couldn’t check your account right now. Try again in a moment.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" variant="outline" onClick={() => void refreshAccount().catch(() => {})}>
              Try again
            </Button>
            <Button type="button" variant="ghost" onClick={() => void signOut().catch(() => {})}>
              Sign out
            </Button>
          </div>
        </section>
      </main>
    )
  }
  return <>{children}</>
}
