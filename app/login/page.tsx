"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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
import { ArrowUp, Check, FileText, Loader2, Mail, Rocket } from "lucide-react"

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">

      {/* ── Form column ── */}
      <div className="flex min-h-screen flex-col px-5 py-7 sm:px-8 md:min-h-0 md:px-10 lg:px-14 xl:px-16">
        <Link href="/" className="flex w-fit items-center gap-2">
          <Image src="/Images/lotus-official-logo.png" alt="Lotus" width={30} height={30} className="object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Lotus.build</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto w-full max-w-[400px]"
          >
            <h1 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
              Welcome back
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Sign in to continue building with Lotus.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-[13px] text-destructive">
                {error}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background text-[13.5px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background text-[13.5px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GithubIcon />
                Continue with GitHub
              </button>
            </div>

            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-border/60 bg-background text-[14px] placeholder:text-muted-foreground/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Password</Label>
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
                  placeholder="Your password"
                  className="h-11 rounded-xl border-border/60 bg-background text-[14px] placeholder:text-muted-foreground/50"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Create one
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
        </p>
      </div>

      {/* ── Illustration column ── */}
      <div className="hidden md:flex md:items-stretch md:p-5 lg:p-7">
        <div className="relative flex w-full overflow-hidden rounded-[2rem] bg-primary text-primary-foreground">

          {/* Ambient glow layers */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/30 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-accent/15 blur-[80px]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground/[0.03] blur-[60px]" />

          <div className="relative flex w-full flex-col justify-between p-7 xl:p-10">

            {/* Headline */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/10 bg-primary-foreground/[0.06] px-3 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <span className="text-[11px] font-medium text-primary-foreground/50">Session active</span>
              </div>
              <h2 className="mt-4 max-w-[260px] text-[1.75rem] font-semibold leading-[1.06] tracking-[-0.045em] xl:max-w-xs xl:text-[2rem]">
                Pick up where your build left off.
              </h2>
            </div>

            {/* Workspace mock */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Browser window */}
              <div className="overflow-hidden rounded-2xl border border-primary-foreground/10 bg-background shadow-[0_32px_80px_-16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]">

                {/* Title bar */}
                <div className="flex h-9 items-center gap-3 border-b border-border/60 bg-sidebar px-3.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex flex-1 items-center justify-center">
                    <div className="flex h-5 items-center gap-1 rounded-md bg-muted/70 px-3">
                      <span className="text-[9.5px] text-muted-foreground">lotus.build/app/my-project</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex h-6 items-center gap-1 rounded-md bg-accent px-2">
                    <Rocket className="h-2.5 w-2.5 text-accent-foreground" />
                    <span className="text-[9.5px] font-semibold text-accent-foreground">Deploy</span>
                  </div>
                </div>

                {/* Split body */}
                <div className="grid grid-cols-[5fr_7fr] divide-x divide-border/50" style={{ height: 284 }}>

                  {/* Left — agent feed */}
                  <div className="flex flex-col overflow-hidden bg-sidebar">
                    {/* Tab bar */}
                    <div className="flex items-center border-b border-border/50 px-3">
                      <div className="relative border-b-2 border-foreground py-2 pr-3">
                        <span className="text-[10px] font-semibold text-foreground">Chat</span>
                      </div>
                      <div className="py-2 px-3">
                        <span className="text-[10px] text-muted-foreground/60">Files</span>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex flex-col gap-2.5 overflow-hidden p-3">
                      {/* User bubble */}
                      <div className="flex justify-end">
                        <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-foreground px-2.5 py-1.5">
                          <p className="text-[10px] leading-relaxed text-background">
                            Add a pricing section, 3 tiers
                          </p>
                        </div>
                      </div>

                      {/* Lotus response */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                            <span className="text-[8px] font-bold text-accent">L</span>
                          </div>
                          <span className="text-[9.5px] font-semibold text-muted-foreground">Lotus</span>
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 w-full rounded-full bg-muted/80" />
                          <div className="h-1.5 w-5/6 rounded-full bg-muted/60" />
                          <div className="h-1.5 w-3/4 rounded-full bg-muted/40" />
                        </div>
                      </div>

                      {/* File done */}
                      <div className="rounded-lg border border-border/60 bg-background p-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10">
                            <FileText className="h-3 w-3 text-accent" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9.5px] font-semibold text-foreground">pricing.tsx</p>
                            <p className="text-[9px] text-muted-foreground">247 lines added</p>
                          </div>
                          <Check className="h-3 w-3 shrink-0 text-accent" />
                        </div>
                      </div>

                      {/* File in progress */}
                      <div className="rounded-lg border border-border/60 bg-background p-2 opacity-65">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9.5px] font-semibold text-foreground">globals.css</p>
                            <p className="text-[9px] text-muted-foreground">Updating…</p>
                          </div>
                          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-border border-t-accent" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right — live preview */}
                  <div className="flex flex-col overflow-hidden bg-background">
                    {/* Preview bar */}
                    <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      <span className="text-[9.5px] text-muted-foreground">Live preview</span>
                    </div>

                    {/* Page mock — pricing section */}
                    <div className="flex-1 overflow-hidden p-3.5 space-y-3">
                      {/* Section title */}
                      <div className="space-y-1 text-center">
                        <div className="mx-auto h-2.5 w-20 rounded-full bg-foreground/70" />
                        <div className="mx-auto h-1.5 w-28 rounded-full bg-muted/70" />
                        <div className="mx-auto h-1.5 w-20 rounded-full bg-muted/50" />
                      </div>

                      {/* 3 pricing cards */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { featured: false },
                          { featured: true },
                          { featured: false },
                        ].map(({ featured }, i) => (
                          <div
                            key={i}
                            className={`rounded-xl border p-2 ${featured
                              ? "border-accent/25 bg-primary shadow-[0_6px_20px_rgba(0,0,0,0.22)]"
                              : "border-border/80 bg-card"
                            }`}
                          >
                            {featured && (
                              <div className="mb-1.5 inline-flex rounded-full bg-accent px-1.5 py-px">
                                <span className="text-[7px] font-bold uppercase tracking-wide text-accent-foreground">Popular</span>
                              </div>
                            )}
                            <div className={`mb-1.5 h-2.5 w-10 rounded-full ${featured ? "bg-primary-foreground/80" : "bg-foreground/65"}`} />
                            <div className={`mb-0.5 h-1.5 w-full rounded-full ${featured ? "bg-primary-foreground/20" : "bg-muted"}`} />
                            <div className={`mb-3 h-1.5 w-3/4 rounded-full ${featured ? "bg-primary-foreground/15" : "bg-muted/70"}`} />
                            <div className={`h-6 w-full rounded-lg ${featured ? "bg-accent" : "bg-muted/50"}`} />
                          </div>
                        ))}
                      </div>

                      {/* CTA strip */}
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-sm bg-accent/50" />
                          <div className="h-1.5 w-12 rounded-full bg-foreground/30" />
                        </div>
                        <div className="flex gap-1.5">
                          <div className="h-1.5 w-7 rounded-full bg-muted-foreground/25" />
                          <div className="h-1.5 w-7 rounded-full bg-muted-foreground/25" />
                        </div>
                      </div>

                      {/* Input mock */}
                      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background px-2.5 py-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted/60" />
                        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent">
                          <ArrowUp className="h-2.5 w-2.5 text-accent-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tagline */}
            <p className="max-w-[260px] text-[12px] leading-relaxed text-primary-foreground/40 xl:max-w-xs">
              Your projects, memory, previews, and deployments stay connected in one calm workspace.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot password dialog */}
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
            <div className="rounded-xl border border-border/50 bg-muted px-4 py-3 text-[13px] text-foreground">
              Check your inbox for the reset link. Don&apos;t see it? Check your spam folder.
            </div>
          ) : (
            <form onSubmit={handleSendResetLink} className="mt-1 space-y-4">
              {resetError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-[13px] text-destructive">
                  {resetError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-[13px] font-medium text-foreground">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-border/60 bg-background text-[14px]"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={resetLoading}
                className="h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground"
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
