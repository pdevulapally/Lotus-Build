"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Analytics } from "@vercel/analytics/next"
import { getStoredConsent, subscribeToConsent } from "@/lib/privacy/cookie-consent"
import { consentedAnalyticsEvent, isMeasuredPath } from "@/lib/privacy/analytics"

export function ConsentAnalytics() {
  const pathname = usePathname()
  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const refresh = () => setAnalyticsAllowed(getStoredConsent()?.analytics === true)
    refresh()
    return subscribeToConsent(refresh)
  }, [])

  // null = not yet decided — render nothing until we know
  if (!analyticsAllowed || !isMeasuredPath(pathname)) return null

  return <Analytics beforeSend={consentedAnalyticsEvent} />
}
