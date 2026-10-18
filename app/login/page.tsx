"use client"

import { Navbar } from "@/components/ui/navbar"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import {
  AuthFormHeader,
  GoogleMark,
  authGoogleButtonClassName,
  authInputClassName,
  authLinkClassName,
  authPasswordToggleClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-presentation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { getSafeRedirectPath } from "@/lib/auth/redirect"
import { authErrorMessage } from "@/lib/auth/errors"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = getSafeRedirectPath(searchParams.get("redirect"))
  const { signInWithGoogle, signInWithEmail, sendPasswordResetEmail, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user && !loading) router.push(redirect)
  }, [user, loading, router, redirect])

  const handleEmailSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      await signInWithEmail(email, password)
      router.push(redirect)
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError("")
    try {
      await signInWithGoogle()
      router.push(redirect)
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotOpen = () => {
    setForgotOpen(true)
    setResetEmail("")
    setResetError("")
    setResetSent(false)
  }

  const handleSendResetLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetError("")
    try {
      await sendPasswordResetEmail(resetEmail.trim())
      setResetSent(true)
    } catch (err: unknown) {
      setResetError(authErrorMessage(err, 'reset'))
    } finally {
      setResetLoading(false)
    }
  }

  if (loading) {
    return (
      <div role="status" aria-label="Loading your account" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
        <Navbar />

        <div className="site-shell flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
          <div className="grid w-full max-w-md items-start gap-12 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:gap-24">
            <AuthMarketingPanel />

            <section className="min-w-0 rounded-3xl border border-border bg-card p-6 sm:p-8" aria-label="Sign in">
              <AuthFormHeader title="Welcome back." description="Sign in to pick up where you left off." />

            {error ? (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
              >
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              aria-busy={isLoading}
              className={authGoogleButtonClassName}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                or use your email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-5" onSubmit={handleEmailSignIn}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={authInputClassName}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotOpen}
                    className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    Reset password
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`${authInputClassName} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={authPasswordToggleClassName}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                aria-label="Sign in"
                aria-busy={isLoading}
                className={authPrimaryButtonClassName}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>

              <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
                New to Lotus?{" "}
                <Link
                  href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                  className={authLinkClassName}
                >
                  Create account
                </Link>
              </p>

              <div className="mt-6 flex items-center justify-center gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                <Link href="/terms" className={authLinkClassName}>
                  Terms
                </Link>
                <span aria-hidden>·</span>
                <Link href="/privacy" className={authLinkClassName}>
                  Privacy
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-3xl border-border bg-card p-6 shadow-none sm:max-w-md sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl tracking-[-0.035em] text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Enter your email and we will send you a reset link.
            </DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div role="status" className="rounded-xl border border-border bg-muted px-4 py-4 text-sm leading-6 text-foreground">
              Check your inbox for the reset link. If you do not see it, check your spam
              folder.
            </div>
          ) : (
            <form onSubmit={handleSendResetLink} className="mt-1 space-y-4">
              {resetError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
                >
                  {resetError}
                </div>
              ) : null}
              <div className="space-y-2">
                <label
                  htmlFor="reset-email"
                  className="text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={authInputClassName}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={resetLoading}
                aria-label="Send reset link"
                aria-busy={resetLoading}
                className={authPrimaryButtonClassName}
              >
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
