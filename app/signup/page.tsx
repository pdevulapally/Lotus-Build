"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { AuthWorkspaceDemo } from "@/components/auth/auth-workspace-demo"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--muted))_0,transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] text-foreground lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <LotusLogo size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-foreground">Lotus.build</span>
          </Link>
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="rounded-lg border border-border/80 bg-card/70 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            Sign in
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="w-full max-w-[420px]">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Create account</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-5xl">Start building</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Create a workspace for prompts, generated files, previews, GitHub sync, and agent memory.</p>

            {error && <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={handleGoogleSignIn} disabled={isLoading} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border/80 bg-card/80 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                <GoogleIcon /> Google
              </button>
              <button type="button" onClick={handleGithubSignIn} disabled={isLoading} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border/80 bg-card/80 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                <GithubIcon /> GitHub
              </button>
            </div>

            <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">or email</span><div className="h-px flex-1 bg-border" /></div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-lg border-border/80 bg-card/70 px-3.5 text-sm" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="h-11 rounded-lg border-border/80 bg-card/70 px-3.5 text-sm" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" className="h-11 rounded-lg border-border/80 bg-card/70 px-3.5 text-sm" required />
              </div>
              <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-foreground underline-offset-2 hover:underline">Sign in</Link></p>
          </motion.div>
        </div>

        <p className="text-xs text-muted-foreground">By creating an account, you agree to our <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">Terms</Link>{" and "}<Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">Privacy Policy</Link>.</p>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden border-l border-border/70 bg-foreground text-background lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,var(--card)_0,transparent_30%),radial-gradient(circle_at_78%_72%,var(--secondary)_0,transparent_34%)] opacity-20" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,var(--background)_145%)] opacity-40" aria-hidden />
        <div className="relative flex w-full flex-col justify-between p-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-background/60">From first prompt</p>
            <h2 className="mt-6 max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.07em]">Start with a sentence. Shape the interface in chat.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-background/70">Lotus Build keeps the generated app, preview, and iteration history in one focused workspace.</p>
          </div>
          <div className="ml-auto w-full max-w-xl">
            <AuthWorkspaceDemo userMessage="Build a premium launch page for an AI design studio." agentMessage="I'll start with a clear hero, realistic sections, and a preview you can refine in chat." workingLabel="Generating layout and first sections..." />
          </div>
          <p className="max-w-sm text-xs leading-6 text-background/60">Designed for builders who want taste and speed in the same place.</p>
        </div>
      </aside>
    </div>
  )
}
