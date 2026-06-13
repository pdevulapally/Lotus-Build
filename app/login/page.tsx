"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowUp, Loader2, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/projects"
  const { signInWithGoogle, signInWithGithub, signInWithEmail, sendPasswordResetEmail, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
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

  const handleGithubSignIn = async () => {
    setIsLoading(true)
    setError("")
    try {
      await signInWithGithub()
      router.push(redirect)
    } catch {
      setError("Failed to sign in with GitHub.")
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

  const handleSendResetLink = async (e: React.FormEvent) => {
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Form */}
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <img src="/Images/lotus-official-logo.png" alt="Lotus.build" className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Lotus.build</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto w-full max-w-[400px]"
          >
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[2.25rem]">
              Welcome to Lotus.build
            </h1>

            {error ? (
              <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-[14px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Log in with Google
            </button>

            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-[14px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Log in with GitHub
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-12 rounded-xl border-border bg-card text-[14px] placeholder:text-muted-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotOpen}
                    className="text-[12px] text-muted-foreground transition hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-12 rounded-xl border-border bg-card text-[14px] placeholder:text-muted-foreground"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>

      {/* Visual */}
      <div className="hidden bg-secondary/40 p-6 lg:block lg:p-8">
        <div className="relative flex h-full min-h-[620px] overflow-hidden rounded-[2rem] border border-border bg-primary text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,var(--accent)_0,transparent_22%),radial-gradient(circle_at_80%_70%,var(--slate-mid)_0,transparent_34%)] opacity-35" />
          <div className="absolute inset-x-10 top-10 h-px bg-primary-foreground/10" />
          <div className="relative flex w-full flex-col justify-between p-10 xl:p-12">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/45">
                  Lotus workspace
                </p>
                <h2 className="mt-3 max-w-sm text-4xl font-semibold leading-[0.98] tracking-[-0.055em]">
                  Pick up where your build left off.
                </h2>
              </div>
              <div className="rounded-full border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-1.5 text-[11px] text-primary-foreground/65">
                Live preview ready
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mx-auto w-full max-w-[560px]"
            >
              <div className="relative rounded-[1.75rem] border border-primary-foreground/10 bg-card p-4 text-foreground shadow-[0_34px_90px_-46px_var(--accent)]">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-soft-foreground">
                    Synced
                  </span>
                </div>

                <div className="grid gap-4 pt-4">
                  <div className="rounded-2xl bg-background p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Current project
                    </p>
                    <div className="mt-4 grid grid-cols-[1.1fr_0.9fr] gap-4">
                      <div>
                        <div className="h-5 w-3/4 rounded-full bg-primary" />
                        <div className="mt-3 h-3 w-full rounded-full bg-muted" />
                        <div className="mt-2 h-3 w-5/6 rounded-full bg-muted" />
                        <div className="mt-5 h-9 w-28 rounded-full bg-accent" />
                      </div>
                      <div className="rounded-2xl border border-border bg-card p-3">
                        <div className="h-20 rounded-xl bg-slate-soft" />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="h-10 rounded-lg bg-muted" />
                          <div className="h-10 rounded-lg bg-muted" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {["Plan", "Preview", "Deploy"].map((item) => (
                      <div key={item} className="rounded-2xl border border-border bg-card p-3">
                        <div className="mb-3 h-1.5 w-8 rounded-full bg-accent" />
                        <p className="text-[12px] font-semibold text-foreground">{item}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Ready</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-primary px-4 text-primary-foreground">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-primary-foreground/70">
                      Continue refining homepage motion and pricing copy
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <ArrowUp className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            <p className="max-w-md text-[13px] leading-relaxed text-primary-foreground/55">
              Your projects, memory, previews, integrations, and deployments stay connected in one calm workspace.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link.
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-[13px] text-success-soft-foreground">
              Check your inbox for the reset link. Don&apos;t see it? Check your spam folder.
            </div>
          ) : (
            <form onSubmit={handleSendResetLink} className="mt-1 space-y-4">
              {resetError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                  {resetError}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[13px] font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-12 rounded-xl border-border bg-card text-[14px]"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={resetLoading}
                className="h-12 w-full rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground"
              >
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
