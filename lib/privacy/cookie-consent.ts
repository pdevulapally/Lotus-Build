import { z } from 'zod'

export const CONSENT_STORAGE_KEY = 'lotus-cookie-consent'
export const CONSENT_UPDATED_EVENT = 'lotus-consent-updated'
export const OPEN_COOKIE_PREFERENCES_EVENT = 'lotus-open-cookie-preferences'
export const CONSENT_VERSION = 1

const consentSchema = z.object({
  version: z.literal(CONSENT_VERSION), essential: z.literal(true),
  analytics: z.boolean(), decidedAt: z.number().int().positive(),
}).strict()
export type CookieConsent = z.infer<typeof consentSchema>

// A failed persistence write must never leave old permission active in this tab.
let unsavedChoice: CookieConsent | undefined

export function parseConsent(raw: string | null, now = Date.now()): CookieConsent | null {
  if (!raw) return null
  try {
    const result = consentSchema.safeParse(JSON.parse(raw))
    return result.success && result.data.decidedAt <= now ? result.data : null
  } catch { return null }
}

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  if (unsavedChoice) return unsavedChoice
  try { return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY)) }
  catch { return null }
}

export function saveConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = { version: CONSENT_VERSION, essential: true, analytics, decidedAt: Date.now() }
  // Failed grants fail closed; failed withdrawal still applies in this tab.
  unsavedChoice = { ...consent, analytics: false }
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
    unsavedChoice = undefined
  } catch {
    throw new Error('Your choice could not be saved. Optional analytics is off in this tab. Allow browser storage and try again.')
  } finally {
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT))
  }
  return consent
}

export function subscribeToConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) {
      unsavedChoice = undefined
      onChange()
    }
  }
  window.addEventListener(CONSENT_UPDATED_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CONSENT_UPDATED_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))
}
