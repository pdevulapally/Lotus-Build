"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Cookie, X, ChevronDown, Shield, BarChart2, Settings2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CookieConsent = {
  essential: true          // always on — cannot be disabled
  analytics: boolean
  functional: boolean
  decidedAt: number        // unix ms
}

const STORAGE_KEY = "lotus-cookie-consent"

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CookieConsent
  } catch {
    return null
  }
}

function saveConsent(analytics: boolean, functional: boolean): CookieConsent {
  const consent: CookieConsent = {
    essential: true,
    analytics,
    functional,
    decidedAt: Date.now(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
    window.dispatchEvent(new CustomEvent("lotus-consent-updated", { detail: consent }))
  } catch {}
  return consent
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: "essential" as const,
    icon: Shield,
    label: "Essential",
    description:
      "Required for the website to function. Includes authentication sessions, security tokens, and CSRF protection. These cannot be disabled.",
    alwaysOn: true,
  },
  {
    key: "analytics" as const,
    icon: BarChart2,
    label: "Analytics",
    description:
      "Help us understand how visitors navigate the site so we can improve it. We use Vercel Analytics — no third-party ad trackers.",
    alwaysOn: false,
  },
  {
    key: "functional" as const,
    icon: Settings2,
    label: "Functional",
    description:
      "Remember your preferences such as UI settings and theme choices to personalise your experience.",
    alwaysOn: false,
  },
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-md ring-0 transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  checked,
  onChange,
}: {
  category: (typeof CATEGORIES)[number]
  checked: boolean
  onChange?: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = category.icon

  return (
    <div className="lotus-glass-control rounded-xl border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{category.label}</span>
            {category.alwaysOn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Always on
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Toggle
            checked={checked}
            disabled={category.alwaysOn}
            onChange={onChange}
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle details"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
            />
          </button>
        </div>
      </div>
      {open && (
        <div className="lotus-glass-inset border-t border-border px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{category.description}</p>
        </div>
      )}
    </div>
  )
}

// ─── Preferences modal ────────────────────────────────────────────────────────

function PreferencesModal({
  initial,
  onSave,
  onClose,
}: {
  initial: { analytics: boolean; functional: boolean }
  onSave: (analytics: boolean, functional: boolean) => void
  onClose: () => void
}) {
  const [analytics, setAnalytics] = useState(initial.analytics)
  const [functional, setFunctional] = useState(initial.functional)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/35 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="lotus-glass-strong relative z-10 w-full max-w-lg rounded-2xl border border-border/60 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-modal
        aria-labelledby="cookie-prefs-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/55 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card">
              <Cookie className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p id="cookie-prefs-title" className="text-sm font-semibold text-foreground">
                Cookie Preferences
              </p>
              <p className="text-xs text-muted-foreground">Choose what data we collect</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Categories */}
        <div className="space-y-2.5 p-5">
          {CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat.key}
              category={cat}
              checked={cat.key === "essential" ? true : cat.key === "analytics" ? analytics : functional}
              onChange={
                cat.key === "analytics"
                  ? setAnalytics
                  : cat.key === "functional"
                  ? setFunctional
                  : undefined
              }
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-border/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Read our{" "}
            <Link href="/privacy" className="underline-offset-2 hover:underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave(false, false)}
              className="lotus-glass-control flex-1 sm:flex-none rounded-full border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() => onSave(analytics, functional)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-none"
            >
              <Check className="h-3.5 w-3.5" />
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main banner ──────────────────────────────────────────────────────────────

export function CookieBanner() {
  const [consent, setConsent] = useState<CookieConsent | null | "loading">("loading")
  const [showPrefs, setShowPrefs] = useState(false)

  useEffect(() => {
    setConsent(getStoredConsent())
  }, [])

  const handleAcceptAll = useCallback(() => {
    setConsent(saveConsent(true, true))
    setShowPrefs(false)
  }, [])

  const handleRejectAll = useCallback(() => {
    setConsent(saveConsent(false, false))
    setShowPrefs(false)
  }, [])

  const handleSavePrefs = useCallback((analytics: boolean, functional: boolean) => {
    setConsent(saveConsent(analytics, functional))
    setShowPrefs(false)
  }, [])

  // Not yet determined — don't render anything (avoid flash)
  if (consent === "loading") return null
  // Already decided — don't show banner
  if (consent !== null) return null

  return (
    <>
      {/* ── Banner ── */}
      <div
        role="region"
        aria-label="Cookie consent"
        className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-[22rem] animate-in slide-in-from-bottom-4 duration-500"
      >
        <div className="lotus-glass-strong overflow-hidden rounded-2xl border border-border/60 shadow-xl">
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
                <Cookie className="h-4.5 w-4.5 text-muted-foreground" style={{ width: 18, height: 18 }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  We use cookies
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Essential cookies keep the site working. Optional analytics help us improve it — no ad trackers, ever.{" "}
                  <Link
                    href="/privacy#cookies"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Learn more
                  </Link>
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-3.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={handleRejectAll}
                  className="lotus-glass-control flex-1 rounded-full border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
                >
                  Reject
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPrefs(true)}
                className="self-center text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Manage preferences
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Preferences modal ── */}
      {showPrefs && (
        <PreferencesModal
          initial={{ analytics: true, functional: true }}
          onSave={handleSavePrefs}
          onClose={() => setShowPrefs(false)}
        />
      )}
    </>
  )
}

// ─── Re-open preferences hook (for settings pages) ────────────────────────────

export function useCookiePreferences() {
  const [consent, setConsent] = useState<CookieConsent | null>(null)

  useEffect(() => {
    setConsent(getStoredConsent())

    const handler = (e: Event) => {
      setConsent((e as CustomEvent<CookieConsent>).detail)
    }
    window.addEventListener("lotus-consent-updated", handler)
    return () => window.removeEventListener("lotus-consent-updated", handler)
  }, [])

  const update = useCallback((analytics: boolean, functional: boolean) => {
    setConsent(saveConsent(analytics, functional))
  }, [])

  return { consent, update }
}
