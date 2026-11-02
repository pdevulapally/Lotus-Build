import { getStoredConsent } from './cookie-consent'

// Do not measure workspaces, authentication or OAuth/checkout callbacks.
const measuredPaths = new Set(['/welcome', '/pricing', '/help', '/privacy', '/terms'])

export const isMeasuredPath = (pathname: string | null): boolean => pathname !== null && measuredPaths.has(pathname)

export function consentedAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (getStoredConsent()?.analytics !== true) return null
  try {
    const url = new URL(event.url, window.location.origin)
    if (url.origin !== window.location.origin || !isMeasuredPath(url.pathname)) return null
    return { ...event, url: `${url.origin}${url.pathname}` }
  } catch { return null }
}
