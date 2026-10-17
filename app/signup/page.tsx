"use client"

import { Navbar } from "@/components/ui/navbar"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getSafeRedirectPath } from "@/lib/auth/redirect"
import { authErrorMessage } from "@/lib/auth/errors"

const authInputClassName =
  "lotus-glass-control w-full rounded-2xl border px-4 py-3.5 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"

type PasswordPolicyRule = {
  id: string
  label: string
  test: (password: string) => boolean
}

const passwordPolicyRules: PasswordPolicyRule[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (password) => password.length >= 12,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
]

function getPasswordPolicyIssues(password: string) {
  return passwordPolicyRules.filter((rule) => !rule.test(password))
}

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

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = getSafeRedirectPath(searchParams.get("redirect"))
  const { signInWithGoogle, signUpWithEmail, user, loading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const passwordPolicyIssues = getPasswordPolicyIssues(password)

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

  const handleEmailSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (passwordPolicyIssues.length > 0) {
      setError("Password does not meet the security requirements below.")
      return
    }
    setIsLoading(true)
    try {
      await signUpWithEmail(email, password)
      router.push(redirect)
    } catch (error) {
      setError(authErrorMessage(error, 'sign-up'))
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
    } catch (error) {
      setError(authErrorMessage(error))
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
    <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <Navbar />

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex w-full max-w-5xl items-center justify-center gap-16 lg:justify-between">
          <AuthMarketingPanel />

          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-8">
            <div className="flex items-center justify-center gap-6 border-b border-border pb-4">
              <span className="-mb-px border-b-2 border-foreground pb-3 text-sm font-semibold text-foreground">
                Sign Up
              </span>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="-mb-px pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Log In
              </Link>
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

          <form className="mt-5 space-y-5" onSubmit={handleEmailSignUp}>
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
                <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    className={`${authInputClassName} pr-12`}
                    aria-describedby="password-policy"
                    aria-invalid={password.length > 0 && passwordPolicyIssues.length > 0}
                    minLength={12}
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
                <div
                  id="password-policy"
                  className="lotus-glass-inset rounded-2xl px-4 py-3 text-xs leading-5 text-muted-foreground"
                >
                  <p className="font-medium text-foreground">Password requirements</p>
                  <ul className="mt-2 space-y-1.5">
                    {passwordPolicyRules.map((rule) => {
                      const isMet = rule.test(password)

                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-2 ${
                            isMet ? "text-success-soft-foreground" : "text-muted-foreground"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                              isMet ? "bg-success text-primary-foreground" : "bg-border-strong/40"
                            }`}
                          >
                            {isMet && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </span>
                          <span>{rule.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className={`${authInputClassName} pr-12`}
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute inset-y-0 right-3 flex items-center rounded-lg px-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
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
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create account"
                )}
              </Button>
          </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirect)}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>

              <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
          </div>
        </div>
      </div>
    </main>
  )
}
