"use client"

import React, { useEffect } from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, Loader2, Rocket, ShieldCheck, Sparkles } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const { signInWithGoogle, signInWithGithub, signUpWithEmail, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user && !loading) {
      router.push(redirect)
    }
  }, [user, loading, router, redirect])

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      await signUpWithEmail(email, password)
      router.push(redirect)
    } catch (err) {
      setError("Failed to create account. Email may already be in use.")
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
    } catch (err) {
      setError("Failed to sign in with Google")
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
    } catch (err) {
      setError("Failed to sign in with GitHub")
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfaf6] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900/20" />
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fcfaf6] flex items-center justify-center p-4 sm:p-6">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-200/40 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#e0dbd1]/50 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-white/60 blur-[80px]" />
      </div>

      {/* Floating UI Decorative Elements (Desktop only) */}
      <div className="hidden xl:block absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute left-[8%] bottom-[25%] w-64 rounded-2xl border border-[#e0dbd1]/60 bg-white/40 p-4 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
            <div className="h-1.5 w-12 rounded bg-zinc-200" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-full rounded-xl bg-white/80 border border-zinc-100" />
            <div className="h-8 w-full rounded-xl bg-white/80 border border-zinc-100" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="absolute right-[8%] top-[20%] w-64 rounded-2xl border border-[#e0dbd1]/60 bg-white/40 p-4 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div className="h-3 w-24 rounded bg-zinc-200" />
          </div>
          <div className="h-1.5 w-full rounded bg-zinc-100" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="h-10 w-10 rounded-xl bg-zinc-950 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900">Lotus.build</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Join the future</h1>
          <p className="mt-2 text-[13.5px] text-zinc-500 leading-relaxed">
            Create your account and start building today.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-[#e0dbd1]/80 bg-white/70 p-6 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-[13px] font-medium text-red-600 text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-3.5">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#e0dbd1] bg-white text-[13px] font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md disabled:opacity-50"
            >
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.18em] font-bold">
              <span className="bg-white/0 px-4 text-zinc-400">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignUp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[12px] font-semibold text-zinc-700 ml-1">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-2xl border-[#e0dbd1] bg-[#fcfaf6]/50 text-[13.5px] transition-all focus:bg-white focus:ring-4 focus:ring-zinc-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[12px] font-semibold text-zinc-700 ml-1">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="h-12 rounded-2xl border-[#e0dbd1] bg-[#fcfaf6]/50 text-[13.5px] transition-all focus:bg-white focus:ring-4 focus:ring-zinc-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[12px] font-semibold text-zinc-700 ml-1">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="h-12 rounded-2xl border-[#e0dbd1] bg-[#fcfaf6]/50 text-[13.5px] transition-all focus:bg-white focus:ring-4 focus:ring-zinc-100"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-2xl bg-zinc-900 text-[13px] font-bold text-white shadow-lg transition-all hover:bg-zinc-800 hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-[13px] text-zinc-500">
            Already have an account?{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(redirect)}`}
              className="font-bold text-zinc-900 hover:underline decoration-[#e0dbd1] decoration-2 underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest">
            Join thousands of builders on Lotus
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

