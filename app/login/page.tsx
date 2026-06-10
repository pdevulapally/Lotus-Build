"use client"

import React, { useEffect } from "react"
import { useState } from "react"
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
import { Loader2, Mail, ArrowRight, Zap, Shield, Globe } from "lucide-react"

const FEATURES = [
  {
    icon: Zap,
    title: "Build in seconds",
    desc: "Describe your idea and watch it come to life instantly.",
  },
  {
    icon: Shield,
    title: "Your projects, secured",
    desc: "All your work is saved and accessible from any device.",
  },
  {
    icon: Globe,
    title: "Ship with one click",
    desc: "Deploy to Netlify or Vercel straight from the editor.",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/projects"
  const { signInWithGoogle, signInWithGithub, signInWithEmail, sendPasswordResetEmail, user, loading } = useAuth()

  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState("")
  const [forgotOpen, setForgotOpen]     = useState(false)
  const [resetEmail, setResetEmail]     = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError]     = useState("")
  const [resetSent, setResetSent]       = useState(false)

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col bg-primary relative overflow-hidden">
        {/* Subtle grain + glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 20% 20%, color-mix(in oklch, var(--primary-foreground) 6%, transparent) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 80%, color-mix(in oklch, var(--brand-glow) 14%, transparent) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 w-fit group">
            <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-9 w-9 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-primary-foreground">Lotus.build</span>
          </Link>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center mt-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60 mb-5">
                Welcome back
              </p>
              <h1 className="text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight text-primary-foreground">
                Sign in and get<br />back to building.
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-primary-foreground/65 max-w-sm">
                Your projects, previews, and deployments are waiting. Pick up exactly where you left off.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              className="mt-12 space-y-4"
            >
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary-foreground/10 border border-primary-foreground/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-primary-foreground/70" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-primary-foreground">{title}</p>
                    <p className="text-[12.5px] leading-relaxed text-primary-foreground/55">{desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom */}
          <p className="text-[11.5px] text-primary-foreground/45 mt-10" suppressHydrationWarning>
            © {new Date().getFullYear()} Lotus.build · All rights reserved
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-5 py-10 sm:px-8">
        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
          <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-bold tracking-tight text-foreground">Lotus.build</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h2>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirect)}`}
                className="font-semibold text-foreground hover:text-foreground underline underline-offset-2 decoration-border-strong"
              >
                Sign up free
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-[0_4px_24px_-6px_var(--primary)] p-6 sm:p-7">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600"
              >
                {error}
              </motion.div>
            )}

            {/* OAuth buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex h-11 items-center justify-center gap-2.5 rounded-xl border border-border bg-card text-[13px] font-medium text-foreground transition-all hover:bg-muted hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>

              <button
                onClick={handleGithubSignIn}
                disabled={isLoading}
                className="flex h-11 items-center justify-center gap-2.5 rounded-xl border border-border bg-card text-[13px] font-medium text-foreground transition-all hover:bg-muted hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[11.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  or with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12.5px] font-medium text-muted-foreground">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-border bg-muted text-[13.5px] text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-border-strong"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[12.5px] font-medium text-muted-foreground">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotOpen}
                    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
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
                  className="h-11 rounded-xl border-border bg-muted text-[13.5px] text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-border-strong"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-accent text-[13.5px] font-semibold text-accent-foreground hover:bg-accent/90 active:scale-[0.99] transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </form>

            {/* Terms */}
            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </div>

      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[13px]">
              Enter your email and we&apos;ll send you a reset link.
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
              Check your inbox for the reset link. Don&apos;t see it? Check your spam folder.
            </div>
          ) : (
            <form onSubmit={handleSendResetLink} className="space-y-4 mt-1">
              {resetError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  {resetError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-[12.5px] font-medium text-muted-foreground">
                  Email address
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-border bg-muted text-[13.5px] placeholder:text-muted-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={resetLoading}
                className="h-11 w-full rounded-xl bg-accent text-[13.5px] font-semibold text-accent-foreground hover:bg-accent/90"
              >
                {resetLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
