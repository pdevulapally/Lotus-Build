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
import { Loader2, ArrowRight, Rocket, Users, Star } from "lucide-react"

const FEATURES = [
  {
    icon: Rocket,
    title: "From idea to live site",
    desc: "Describe what you want and watch your site build itself in seconds.",
  },
  {
    icon: Users,
    title: "Built for real businesses",
    desc: "Trusted by startups, agencies, and enterprises shipping production sites.",
  },
  {
    icon: Star,
    title: "Always improving",
    desc: "Your feedback shapes every release. We ship new capabilities weekly.",
  },
]

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/projects"
  const { signInWithGoogle, signInWithGithub, signUpWithEmail, user, loading } = useAuth()

  const [email, setEmail]                     = useState("")
  const [password, setPassword]               = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading]             = useState(false)
  const [error, setError]                     = useState("")

  useEffect(() => {
    if (user && !loading) router.push(redirect)
  }, [user, loading, router, redirect])

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col bg-primary relative overflow-hidden">
        {/* Grain texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 80% 10%, rgba(255,255,255,0.04) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 20% 90%, rgba(201,122,43,0.08) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 w-fit group">
            <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-9 w-9 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-white">Lotus.build</span>
          </Link>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center mt-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-5">
                Get started free
              </p>
              <h1 className="text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight text-white">
                Build something<br />remarkable today.
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-zinc-400 max-w-sm">
                No templates, no compromises. Describe your vision and Lotus builds it — production-ready from the first prompt.
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
                  <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">{title}</p>
                    <p className="text-[12.5px] leading-relaxed text-zinc-500">{desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom */}
          <p className="text-[11.5px] text-zinc-600 mt-10">
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
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h2>
            <p className="mt-1.5 text-[13.5px] text-zinc-500">
              Already have an account?{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="font-semibold text-zinc-800 hover:text-foreground underline underline-offset-2 decoration-zinc-300"
              >
                Sign in
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] p-6 sm:p-7">
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
                className="flex h-11 items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex h-11 items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white text-[13px] font-medium text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11.5px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                  or with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12.5px] font-medium text-zinc-600">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-[13.5px] text-foreground placeholder:text-zinc-400 focus:bg-white focus:border-zinc-300"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12.5px] font-medium text-zinc-600">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-[13.5px] text-foreground placeholder:text-zinc-400 focus:bg-white focus:border-zinc-300"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[12.5px] font-medium text-zinc-600">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50 text-[13.5px] text-foreground placeholder:text-zinc-400 focus:bg-white focus:border-zinc-300"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-accent text-[13.5px] font-semibold text-white hover:bg-accent/90 active:scale-[0.99] transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    Create account <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </form>

            {/* Terms */}
            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-zinc-400">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
