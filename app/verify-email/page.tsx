"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { EmailCodeVerification } from "@/components/auth/email-code-verification"
import { AuthFormHeader } from "@/components/auth/auth-presentation"
import { Navbar } from "@/components/ui/navbar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getSafeRedirectPath } from "@/lib/auth/redirect"

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div role="status" aria-label="Loading your account" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = getSafeRedirectPath(searchParams.get("redirect"))
  const { user, account, loading, accountError, refreshAccount, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
    } else if (account?.emailVerified) {
      router.replace(redirect)
    }
  }, [account?.emailVerified, loading, redirect, router, user])

  const useDifferentAccount = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.")
    } finally {
      setSigningOut(false)
    }
  }

  if (loading || !user || (!account && !accountError) || account?.emailVerified) {
    return (
      <div role="status" aria-label="Loading your account" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <Navbar />
      <div className="site-shell flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
        <div className="grid w-full max-w-md items-start gap-12 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:gap-24">
          <AuthMarketingPanel />
          <section className="min-w-0 rounded-3xl border border-border bg-card p-6 sm:p-8" aria-label="Verify your email">
            <AuthFormHeader
              title="Check your email."
              description="Enter the 6-digit code to finish setting up your LotusBuild account."
            />
            {accountError ? (
              <div role="alert" className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                {accountError}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => void refreshAccount().catch(() => {})}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : null}
            {account ? (
              <EmailCodeVerification
                email={user.email ?? account.email}
                autoSend
                onVerified={() => router.push(redirect)}
              />
            ) : null}
            {signOutError ? <p role="alert" className="mt-4 text-sm text-destructive">{signOutError}</p> : null}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void useDifferentAccount()}
              className="mt-5 w-full text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Use a different account"}
            </button>
          </section>
        </div>
      </div>
    </main>
  )
}
