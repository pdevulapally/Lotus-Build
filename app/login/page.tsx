"use client"

import { BrandWordmark } from "@/components/ui/brand-wordmark"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
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

const authInputClassName =
  "lotus-glass-control w-full rounded-2xl border px-4 py-3.5 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"

function GoogleMark() {
  return (
    <img
      src="/Images/google-icon-logo-svgrepo-com.svg"
      alt=""
      aria-hidden
      className="h-5 w-5 shrink-0"
    />
  )
}

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
    } catch {
      setError("Invalid email or password. Please try again.")
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
    } catch {
      setError("Failed to sign in with Google.")
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
      const message =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code === "auth/user-not-found"
            ? "No account found with this email."
            : ((err as { message?: string }).message ?? "Failed to send reset link.")
          : "Failed to send reset link."
      setResetError(message)
    } finally {
      setResetLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
        <div className="px-5 pt-6 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Lotus.build home"
          ><BrandWordmark /></Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="flex w-full max-w-5xl items-center justify-center gap-16 lg:justify-between">
            <AuthMarketingPanel />

            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
              <div className="flex items-center justify-center gap-6 border-b border-border pb-4">
                <Link
                  href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                  className="-mb-px pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign Up
                </Link>
                <span className="-mb-px border-b-2 border-foreground pb-3 text-sm font-semibold text-foreground">
                  Log In
                </span>
              </div>

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="lotus-glass-control mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border text-sm font-medium text-foreground transition-colors hover:border-border-strong disabled:pointer-events-none disabled:opacity-50"
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Or continue with
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="mt-5 space-y-5" onSubmit={handleEmailSignIn}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
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
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotOpen}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
                    className="absolute inset-y-0 right-3 flex items-center rounded-lg px-1 text-muted-foreground transition-colors hover:text-foreground"
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
                className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                New to Lotus?{" "}
                <Link
                  href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Create account
                </Link>
              </p>

              <div className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
                  Terms
                </Link>
                <span> / </span>
                <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter your email and we will send you a reset link.
            </DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
              Check your inbox for the reset link. If you do not see it, check your spam
              folder.
            </div>
          ) : (
            <form onSubmit={handleSendResetLink} className="mt-1 space-y-4">
              {resetError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {resetError}
                </div>
              ) : null}
              <div className="space-y-2">
                <label
                  htmlFor="reset-email"
                  className="text-sm font-medium text-muted-foreground"
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
                className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
