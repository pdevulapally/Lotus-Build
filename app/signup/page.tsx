"use client"

import { Navbar } from "@/components/ui/navbar"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import {
  AuthFormHeader,
  GoogleMark,
  authGoogleButtonClassName,
  authInputClassName,
  authLinkClassName,
  authPasswordToggleClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-presentation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getSafeRedirectPath } from "@/lib/auth/redirect"
import { authErrorMessage } from "@/lib/auth/errors"

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
      <div role="status" aria-label="Loading your account" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <Navbar />

      <div className="site-shell flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
        <div className="grid w-full max-w-md items-start gap-12 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:gap-24">
          <AuthMarketingPanel />

          <section className="min-w-0 rounded-3xl border border-border bg-card p-6 sm:p-8" aria-label="Create account">
            <AuthFormHeader title="Create your account." description="Start building your next idea with LotusBuild." />

          {error ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            aria-busy={isLoading}
            className={authGoogleButtonClassName}
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              or use your email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-5" onSubmit={handleEmailSignUp}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
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
                <label htmlFor="password" className="text-sm font-medium text-foreground">
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
                    className={authPasswordToggleClassName}
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
                  className="pt-1 text-xs leading-5 text-muted-foreground"
                >
                  <p className="font-medium text-foreground">Password requirements</p>
                  <ul className="mt-2 grid gap-x-3 gap-y-1.5 min-[400px]:grid-cols-2">
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
                              isMet ? "bg-success-soft text-success-soft-foreground" : "border border-border"
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
                  className="text-sm font-medium text-foreground"
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
                    className={authPasswordToggleClassName}
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
                aria-label="Create account"
                aria-busy={isLoading}
                className={authPrimaryButtonClassName}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create account"
                )}
              </Button>
          </form>

              <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirect)}`}
                  className={authLinkClassName}
                >
                  Sign in
                </Link>
              </p>

              <p className="mt-6 border-t border-border pt-5 text-center text-xs leading-5 text-muted-foreground">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className={authLinkClassName}>
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className={authLinkClassName}>
                  Privacy Policy
                </Link>
                .
              </p>
          </section>
        </div>
      </div>
    </main>
  )
}
