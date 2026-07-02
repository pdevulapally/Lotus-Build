"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import {
  CONTACT_FIELD_LIMITS,
  CONTACT_TOPICS,
  contactFormSchema,
  type ContactFormValues,
} from "@/lib/contact-schema"
import { cn } from "@/lib/utils"

const fieldClassName = (hasError: boolean) =>
  cn(
    "w-full rounded-xl border bg-card px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/35 focus:ring-2 focus:ring-ring/25",
    hasError ? "border-destructive" : "border-border"
  )

export function ContactForm() {
  const [token, setToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const honeypotRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", email: "", topic: "", message: "" },
    mode: "onTouched",
  })

  const selectedTopic = watch("topic")
  const messageLength = watch("message")?.length ?? 0

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/contact", { cache: "no-store" })
      if (!res.ok) return null
      const data = (await res.json()) as { token?: unknown }
      return typeof data.token === "string" ? data.token : null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchToken().then((fresh) => {
      if (!cancelled && fresh) setToken(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [fetchToken])

  const postMessage = useCallback(
    (values: ContactFormValues, activeToken: string) =>
      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          token: activeToken,
          website: honeypotRef.current?.value ?? "",
        }),
      }),
    []
  )

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setSending(true)
    try {
      const activeToken = token ?? (await fetchToken())
      if (!activeToken) {
        setServerError("We couldn't reach the server. Check your connection and try again.")
        return
      }

      let res = await postMessage(values, activeToken)
      let data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; fieldErrors?: Record<string, string> }
        | null

      // A stale token just means the tab sat open too long — refresh it and
      // retry once without bothering the user.
      if (res.status === 400 && (data?.code === "token_expired" || data?.code === "token_invalid")) {
        const fresh = await fetchToken()
        if (fresh) {
          setToken(fresh)
          res = await postMessage(values, fresh)
          data = (await res.json().catch(() => null)) as typeof data
        }
      }

      if (res.ok) {
        setSentTo(values.email)
        return
      }

      if (data?.fieldErrors) {
        for (const [field, message] of Object.entries(data.fieldErrors)) {
          setError(field as keyof ContactFormValues, { type: "server", message })
        }
      }
      setServerError(
        res.status === 429
          ? "You've sent several messages recently. Please wait a little while before trying again."
          : data?.error ?? "Something went wrong sending your message. Please try again."
      )
    } finally {
      setSending(false)
    }
  })

  const startAnother = useCallback(() => {
    reset()
    setSentTo(null)
    setServerError(null)
    fetchToken().then((fresh) => {
      if (fresh) setToken(fresh)
    })
  }, [fetchToken, reset])

  if (sentTo) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-foreground" strokeWidth={1.5} aria-hidden="true" />
        <h3 className="mt-5 text-2xl font-medium tracking-[-0.03em] text-foreground">Message sent</h3>
        <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
          We received your message and will reply at <span className="font-medium text-foreground">{sentTo}</span> within
          one business day.
        </p>
        <button
          type="button"
          onClick={startAnother}
          className="mt-7 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative rounded-2xl border border-border bg-card p-6 sm:p-8">
      {/* Honeypot: off-screen field humans never see. Anything typed here marks the submission as a bot. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          ref={honeypotRef}
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            maxLength={CONTACT_FIELD_LIMITS.name.max}
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            className={cn("mt-2 h-12", fieldClassName(Boolean(errors.name)))}
            {...register("name")}
          />
          {errors.name && (
            <p id="contact-name-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="contact-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            maxLength={CONTACT_FIELD_LIMITS.email.max}
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            className={cn("mt-2 h-12", fieldClassName(Boolean(errors.email)))}
            {...register("email")}
          />
          {errors.email && (
            <p id="contact-email-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-foreground">Topic</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((topic) => {
            const isActive = selectedTopic === topic.value
            return (
              <button
                key={topic.value}
                type="button"
                onClick={() => setValue("topic", topic.value, { shouldValidate: true })}
                aria-pressed={isActive}
                title={topic.description}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {topic.label}
              </button>
            )
          })}
        </div>
        <input type="hidden" {...register("topic")} />
        {errors.topic && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {errors.topic.message}
          </p>
        )}
      </fieldset>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="contact-message" className="text-sm font-medium text-foreground">
            Message
          </label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {messageLength}/{CONTACT_FIELD_LIMITS.message.max}
          </span>
        </div>
        <textarea
          id="contact-message"
          rows={6}
          maxLength={CONTACT_FIELD_LIMITS.message.max}
          placeholder="What happened, what you expected, and the project name if it's about a specific build."
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={cn("mt-2 min-h-36 resize-y py-3", fieldClassName(Boolean(errors.message)))}
          {...register("message")}
        />
        {errors.message && (
          <p id="contact-message-error" role="alert" className="mt-1.5 text-xs text-destructive">
            {errors.message.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {sending ? "Sending..." : "Send message"}
        </button>
        <p className="text-xs text-muted-foreground">We reply within one business day.</p>
      </div>
    </form>
  )
}
