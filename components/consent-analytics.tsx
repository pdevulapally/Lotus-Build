"use client"

import { useEffect, useState } from "react"
import { Analytics } from "@vercel/analytics/next"
import { getStoredConsent, type CookieConsent } from "./cookie-banner"

export function ConsentAnalytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    // Read initial consent
    const stored = getStoredConsent()
    setAnalyticsAllowed(stored?.analytics ?? null)

    // Listen for future consent changes
    const handler = (e: Event) => {
      const consent = (e as CustomEvent<CookieConsent>).detail
      setAnalyticsAllowed(consent.analytics)
    }
    window.addEventListener("lotus-consent-updated", handler)
    return () => window.removeEventListener("lotus-consent-updated", handler)
  }, [])

  // null = not yet decided — render nothing until we know
  if (!analyticsAllowed) return null

  return <Analytics />
}
