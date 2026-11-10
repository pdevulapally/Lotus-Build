"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { BackendError } from "@/lib/backend/client"
import { currentBackend } from "@/lib/backend/browser"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmailCodeVerificationProps = {
  buttonClassName?: string
  email: string
  autoSend?: boolean
  onVerified: () => void | Promise<void>
}

function retryAfterSeconds(error: unknown): number | undefined {
  if (!(error instanceof BackendError) || typeof error.details !== "object" || error.details === null) {
    return undefined
  }
  const value = (error.details as { retryAfterSeconds?: unknown }).retryAfterSeconds
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 86_400
    ? value
    : undefined
}

function verificationErrorMessage(error: unknown): string {
  if (error instanceof BackendError) {
    switch (error.code) {
      case "auth/verification-code-invalid":
        return "That code didn’t work. Check it and try again, or request a new one."
      case "auth/verification-code-cooldown":
        return "Please wait a little before requesting another code."
      case "auth/verification-code-daily-limit":
        return "Too many codes requested today. Try again after midnight UTC."
      case "email/daily-limit-reached":
        return "We've hit today's email limit — try again after midnight UTC"
      case "email/delivery-unavailable":
        return "We couldn’t send your verification email just now. Please try again shortly."
      case "auth/email-unavailable":
        return "There isn’t an email address on this account to verify."
      default:
        return error.message
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

export function EmailCodeVerification({
  email,
  buttonClassName,
  autoSend = false,
  onVerified,
}: EmailCodeVerificationProps) {
  const { user, refreshAccount } = useAuth()
  const [code, setCode] = useState("")
  const [hasSent, setHasSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const autoSendAttempted = useRef(false)
  const sendInFlight = useRef(false)
  const verificationInFlight = useRef(false)

  const completeVerification = useCallback(async () => {
    if (!user) throw new Error("Sign in to verify your email.")
    await user.getIdToken(true)
    await refreshAccount()
    await onVerified()
  }, [onVerified, refreshAccount, user])

  const sendCode = useCallback(async () => {
    if (sendInFlight.current || resendAfterSeconds > 0) return
    sendInFlight.current = true
    setIsSending(true)
    setError(null)
    try {
      const result = await currentBackend().sendEmailVerificationCode()
      if (result.verified) {
        await completeVerification()
        return
      }
      setHasSent(true)
      setCode("")
      setResendAfterSeconds(result.resendAfterSeconds)
    } catch (reason) {
      setError(verificationErrorMessage(reason))
      const retryAfter = retryAfterSeconds(reason)
      if (retryAfter !== undefined) setResendAfterSeconds(retryAfter)
    } finally {
      sendInFlight.current = false
      setIsSending(false)
    }
  }, [completeVerification, resendAfterSeconds])

  const verifyCode = useCallback(async (candidate: string) => {
    if (candidate.length !== 6 || verificationInFlight.current) return
    verificationInFlight.current = true
    setIsVerifying(true)
    setError(null)
    try {
      const result = await currentBackend().verifyEmailCode(candidate)
      if (result.verified) {
        await completeVerification()
      } else {
        setError("That code didn’t work. Check it and try again.")
      }
    } catch (reason) {
      setError(verificationErrorMessage(reason))
      const retryAfter = retryAfterSeconds(reason)
      if (retryAfter !== undefined) setResendAfterSeconds(retryAfter)
    } finally {
      verificationInFlight.current = false
      setIsVerifying(false)
    }
  }, [completeVerification])

  useEffect(() => {
    if (resendAfterSeconds <= 0) return
    const timeout = window.setTimeout(() => {
      setResendAfterSeconds((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [resendAfterSeconds])

  useEffect(() => {
    if (!autoSend || autoSendAttempted.current) return
    autoSendAttempted.current = true
    void sendCode()
  }, [autoSend, sendCode])

  const handleCodeChange = (value: string) => {
    const nextCode = value.replace(/\D/g, "").slice(0, 6)
    setCode(nextCode)
    setError(null)
    if (nextCode.length === 6) void verifyCode(nextCode)
  }

  return (
    <section className="space-y-4">
      {hasSent ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>
        </p>
      ) : autoSend && isSending ? (
        <p className="text-sm leading-relaxed text-muted-foreground">Sending a code to {email}…</p>
      ) : null}

      {error ? (
        <p id="email-verification-error" role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}

      {hasSent ? (
        <div className="space-y-3">
          <label htmlFor="email-verification-code" className="block text-sm font-semibold">
            Verification code
          </label>
          <input
            id="email-verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => handleCodeChange(event.currentTarget.value)}
            aria-label="6-digit verification code"
            aria-describedby={error ? "email-verification-error" : undefined}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-center font-mono text-xl font-semibold tracking-[0.55em] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder="000000"
            disabled={isVerifying}
          />
          <Button
            type="button"
            className={cn("w-full", buttonClassName)}
            disabled={code.length !== 6 || isVerifying}
            aria-busy={isVerifying}
            onClick={() => void verifyCode(code)}
          >
            {isVerifying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Verify
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={hasSent ? "outline" : "default"}
          className={buttonClassName}
          disabled={isSending || resendAfterSeconds > 0}
          aria-busy={isSending}
          onClick={() => void sendCode()}
        >
          {isSending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {hasSent ? "Send a new code" : "Send code"}
        </Button>
        {resendAfterSeconds > 0 ? (
          <span className="text-sm tabular-nums text-muted-foreground" role="status" aria-live="polite">
            Available in {formatCountdown(resendAfterSeconds)}
          </span>
        ) : null}
      </div>
    </section>
  )
}
