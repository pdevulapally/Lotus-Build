"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUp, Loader2 } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/projects"
  const { signInWithGoogle, signInWithGithub, signUpWithEmail, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user && !loading) router.push(redirect)
  }, [user, loading, router, redirect])

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim()
    if (ref) {
      try {
        window.localStorage.setItem("lotus_ref", ref)
      } catch {}
    }
  }, [searchParams])

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setIsLoading(true)
    try {
      await signUpWithEmail(email, password)
      router.push(redirect)
    } catch {
      setError("Failed to create account. That email may already be in use.")
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
      setError("Failed to sign up with Google.")
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
      setError("Failed to sign up with GitHub.")
    } finally {
      setIsLoading(false)
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
              Create your Lotus.build account
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              Start free. Describe what you want to build and ship a live preview in minutes.
            </p>

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
              Sign up with Google
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
              Sign up with GitHub
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

            <form onSubmit={handleEmailSignUp} className="space-y-5">
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
                <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-12 rounded-xl border-border bg-card text-[14px] placeholder:text-muted-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-foreground">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
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
              Already have an account?{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* Visual */}
      <div className="hidden bg-secondary/40 p-6 lg:block lg:p-8">
        <div className="relative flex h-full min-h-[620px] overflow-hidden rounded-[2rem] border border-border bg-primary text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,var(--accent)_0,transparent_22%),radial-gradient(circle_at_76%_74%,var(--slate-mid)_0,transparent_34%)] opacity-35" />
          <div className="absolute inset-x-10 top-10 h-px bg-primary-foreground/10" />
          <div className="relative flex w-full flex-col justify-between p-10 xl:p-12">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/45">
                  From first prompt
                </p>
                <h2 className="mt-3 max-w-sm text-4xl font-semibold leading-[0.98] tracking-[-0.055em]">
                  Shape a real product before you write code.
                </h2>
              </div>
              <div className="rounded-full border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-1.5 text-[11px] text-primary-foreground/65">
                Free to start
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
                    Building
                  </span>
                </div>

                <div className="grid gap-4 pt-4">
                  <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-primary px-4 text-primary-foreground">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-primary-foreground/70">
                      Build a polished site for my AI design studio
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <ArrowUp className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
                    <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Plan
                      </p>
                      {["Audience", "Pages", "Style"].map((item) => (
                        <div key={item} className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
                          <span className="text-[12px] font-medium text-foreground">{item}</span>
                          <span className="h-2 w-2 rounded-full bg-success" />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-background p-4">
                      <div className="h-24 rounded-2xl bg-slate-soft" />
                      <div className="mt-4 h-5 w-3/4 rounded-full bg-primary" />
                      <div className="mt-3 h-3 w-full rounded-full bg-muted" />
                      <div className="mt-2 h-3 w-2/3 rounded-full bg-muted" />
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="h-12 rounded-xl bg-card" />
                        <div className="h-12 rounded-xl bg-card" />
                        <div className="h-12 rounded-xl bg-card" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {["Prompt", "Preview", "Deploy"].map((item) => (
                      <div key={item} className="rounded-2xl border border-border bg-card p-3">
                        <div className="mb-3 h-1.5 w-8 rounded-full bg-accent" />
                        <p className="text-[12px] font-semibold text-foreground">{item}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Included</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <p className="max-w-md text-[13px] leading-relaxed text-primary-foreground/55">
              Lotus turns loose ideas into a calm build flow: clarify, generate, preview, refine, and launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
