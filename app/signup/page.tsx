"use client"

import { AuthShell } from "@/components/auth/auth-shell"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Eye, EyeOff, Loader2 } from "lucide-react"
import {
  AuthFormHeader,
  GoogleMark,
  authDividerClassName,
  authLabelClassName,
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
    if (user && !loading && user?.emailVerified) router.push(redirect)
  }, [user, user?.emailVerified, loading, router, redirect])

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
      router.push(`/verify-email?redirect=${encodeURIComponent(redirect)}`)
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
    <AuthShell label="Create account">
      <AuthFormHeader title="Create your account." description="Start building your next idea with LotusBuild." />

          {error ? (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-destructive/10 px-4 py-3 text-[13.5px] font-medium leading-6 text-destructive"
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

          <div className={authDividerClassName} aria-hidden>or use your email</div>

          <form className="space-y-5" onSubmit={handleEmailSignUp}>
              <div className="space-y-2">
                <label htmlFor="email" className={authLabelClassName}>
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
                <label htmlFor="password" className={authLabelClassName}>
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
                <div id="password-policy" className="pt-1">
                  <div className="flex items-center gap-1.5" aria-hidden>
                    {passwordPolicyRules.map((rule, index) => <span key={rule.id} className={`h-1 flex-1 rounded-full transition-colors ${index < passwordPolicyRules.length - passwordPolicyIssues.length ? "bg-foreground" : "bg-border"}`} />)}
                  </div>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5 text-[12px] font-semibold">
                    {passwordPolicyRules.map((rule) => {
                      const isMet = rule.test(password)
                      return (
                        <li key={rule.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${isMet ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                          {isMet && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                          {rule.label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className={authLabelClassName}
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

              <p className="mt-6 text-center text-[14px] font-medium leading-6 text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirect)}`}
                  className={authLinkClassName}
                >
                  Sign in
                </Link>
              </p>

              <p className="mt-6 border-t border-border pt-5 text-center text-[12.5px] font-medium leading-5 text-muted-foreground">
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
    </AuthShell>
  )
}
