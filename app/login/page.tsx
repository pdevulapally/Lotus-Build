"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { motion } from "framer-motion"
import { MeshGradient } from "@paper-design/shaders-react"
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
import { Loader2, Mail } from "lucide-react"

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
    <div className="min-h-screen bg-background p-3 md:grid md:grid-cols-2 md:gap-3">

      {/* ── Form column ── */}
      <div className="flex min-h-[calc(100vh-24px)] flex-col rounded-[2rem] bg-card px-5 py-6 sm:px-8 md:min-h-0 md:px-10 lg:px-14 xl:px-16">
        <Link href="/" className="flex w-fit items-center gap-2">
          <LotusLogo size={30} />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Lotus.build</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto w-full max-w-[420px]"
          >
            <h1 className="text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl">
              Welcome back
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Continue shaping your projects, previews, and launches in one calm workspace.
            </p>

            {error && (
              <div className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                {error}
              </div>
            )}

            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl bg-secondary text-[13.5px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GoogleIcon />
                Google
              </button>
              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={isLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl bg-secondary text-[13.5px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GithubIcon />
                GitHub
              </button>
            </div>

            <div className="my-7 flex justify-center">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                or continue with email
              </span>
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
                  className="h-12 rounded-2xl border-transparent bg-secondary/70 px-4 text-[14px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-border-strong"
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
                  className="h-12 rounded-2xl border-transparent bg-secondary/70 px-4 text-[14px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-border-strong"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
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

      {/* ── Right content ── */}
      <div className="hidden md:flex md:items-stretch">
        <div className="relative flex w-full overflow-hidden rounded-[2rem] text-primary-foreground">
          <MeshGradient
            className="absolute inset-0 h-full w-full"
            colors={["#A34300", "#dbba95", "#d0bce1"]}
            distortion={0.35}
            fit="cover"
            grainMixer={0.08}
            grainOverlay={0.04}
            maxPixelCount={1200000}
            rotation={50}
            scale={1.15}
            speed={0.12}
            swirl={0.18}
          />

          <div className="relative flex w-full flex-col justify-between p-8 lg:p-10">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/50">
                Your workspace is ready
              </p>
              <h2 className="mt-6 max-w-xl text-5xl font-medium leading-[0.98] tracking-[-0.07em] lg:text-6xl">
                Return to the surface that is already in motion.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-primary-foreground/62">
                Sign in and the same prompt thread, preview, and project state are waiting without the dashboard noise.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
              className="max-w-xl rounded-[1.75rem] bg-background/15 p-3 shadow-[0_30px_120px_-70px_var(--accent)] backdrop-blur-xl"
            >
              <div className="rounded-[1.35rem] border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/50">
                    Resume
                  </span>
                  <span className="rounded-full bg-primary-foreground/12 px-3 py-1 text-xs text-primary-foreground/70">
                    Live preview saved
                  </span>
                </div>

                <p className="mt-8 max-w-md text-2xl font-medium leading-[1.08] tracking-[-0.045em] text-primary-foreground">
                  “Tighten the hero, keep the structure, make the page feel more premium.”
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {["Prompt thread", "Preview URL", "Project files"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-primary-foreground/12 px-3 py-1.5 text-xs text-primary-foreground/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            <p className="max-w-sm text-xs leading-6 text-primary-foreground/55">
              Built to feel closer to a creative canvas than an admin panel.
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
