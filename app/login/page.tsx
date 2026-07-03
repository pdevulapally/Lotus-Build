"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { LotusLogo } from "@/components/ui/lotus-logo"
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
  "w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong focus:bg-secondary/60"

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
      <main className="flex min-h-[100dvh] bg-background text-foreground md:flex-row">
        <section className="flex min-h-[100dvh] flex-1 items-center justify-center px-5 py-6 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center">
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Lotus.build home"
              >
                <LotusLogo size={28} />
                <span className="text-[15px] font-semibold text-foreground">Lotus.build</span>
              </Link>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sign in</p>
                <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                  Welcome back
                </h1>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Return to your projects, previews, and follow-up edits without losing
                  the thread.
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <GoogleMark />
                Continue with Google
              </button>

              <div className="relative flex items-center justify-center">
                <span className="w-full border-t border-border" />
                <span className="absolute bg-background px-4 text-sm text-muted-foreground">
                  Or continue with
                </span>
              </div>

              <form className="space-y-5" onSubmit={handleEmailSignIn}>
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
                  className="h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/90"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                New to Lotus?{" "}
                <Link
                  href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Create account
                </Link>
              </p>
            </div>

            <div className="mt-10 text-xs leading-5 text-muted-foreground">
              <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
                Terms
              </Link>
              <span> / </span>
              <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
                Privacy
              </Link>
            </div>
          </div>
        </section>

        <section className="hidden flex-1 p-4 md:block">
          <div className="relative h-full min-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl bg-primary text-primary-foreground">
            <img
              src="/Images/487c1040-cc7a-4bee-867e-84462280fe6e.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-primary/60" aria-hidden />
            <div className="relative flex h-full flex-col justify-between p-8 lg:p-10">
              <div className="max-w-xl pt-8">
                <p className="text-sm font-medium text-primary-foreground/70">
                  Your work stays ready
                </p>
                <h2 className="mt-5 font-display text-5xl font-semibold leading-none text-primary-foreground xl:text-6xl">
                  Come back to the build without rebuilding the brief.
                </h2>
              </div>

              <div className="max-w-md rounded-3xl border border-primary-foreground/15 bg-primary/70 p-5 backdrop-blur-xl">
                <p className="text-sm leading-6 text-primary-foreground/78">
                  Lotus keeps each project, preview, and edit history together so your
                  next session starts in the right place.
                </p>
              </div>
            </div>
          </div>
        </section>
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
                className="h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/90"
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
