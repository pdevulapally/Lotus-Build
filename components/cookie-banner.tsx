"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  getStoredConsent, openCookiePreferences, OPEN_COOKIE_PREFERENCES_EVENT,
  saveConsent, subscribeToConsent, type CookieConsent,
} from '@/lib/privacy/cookie-consent'

export function CookiePreferencesButton({ className }: { className?: string }) {
  return <button type="button" aria-haspopup="dialog" onClick={openCookiePreferences} className={className}>Cookie preferences</button>
}

export function CookieBanner() {
  const [consent, setConsent] = useState<CookieConsent | null | 'loading'>('loading')
  const [open, setOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const refresh = () => setConsent(getStoredConsent())
    const show = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setAnalytics(getStoredConsent()?.analytics === true)
      setError(null)
      setOpen(true)
    }
    refresh()
    const unsubscribe = subscribeToConsent(refresh)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, show)
    return () => {
      unsubscribe()
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, show)
    }
  }, [])

  const save = (allow: boolean) => {
    setError(null)
    try {
      setConsent(saveConsent(allow))
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your cookie choice.')
    }
  }

  return <>
    {consent === null && !open && <section aria-label="Cookie consent" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-lg max-sm:left-4">
      <h2 className="text-sm font-semibold">Your cookie choices</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We use browser storage to run the service. Optional analytics on public pages stays off until you allow it. <Link href="/privacy#cookies" className="underline underline-offset-4">Cookie details</Link></p>
      <footer className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => save(false)}>Reject optional</Button>
        <Button type="button" onClick={() => save(true)}>Accept analytics</Button>
        <Button type="button" variant="ghost" onClick={(event) => { openerRef.current = event.currentTarget; setAnalytics(false); setOpen(true) }}>Manage preferences</Button>
      </footer>
    </section>}
    {error && !open && <p role="alert" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground">{error} <button type="button" className="underline" onClick={() => setOpen(true)}>Review choice</button></p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(event) => {
        if (openerRef.current?.isConnected) { event.preventDefault(); openerRef.current.focus() }
      }}>
        <DialogHeader>
          <DialogTitle>Cookie preferences</DialogTitle>
          <DialogDescription>Choose whether to allow optional analytics. You can change this from the footer or Settings. This choice is separate from accepting the Terms.</DialogDescription>
        </DialogHeader>
        <section aria-labelledby="necessary-storage" className="space-y-2 border-b border-border pb-4">
          <h3 id="necessary-storage" className="text-sm font-medium">Service storage — always on</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Sign-in, security, your cookie choice, pending requests and preferences you ask us to remember. These are not controlled by the analytics switch.</p>
        </section>
        <section className="flex items-start justify-between gap-4">
          <label htmlFor="cookie-analytics" className="space-y-2 text-sm">
            <span className="block font-medium">Public-page analytics</span>
            <span id="cookie-analytics-description" className="block leading-relaxed text-muted-foreground">Vercel Web Analytics measures visits to public information pages. Workspace and sign-in pages are excluded; URL queries and fragments are removed.</span>
          </label>
          <Switch id="cookie-analytics" checked={analytics} onCheckedChange={setAnalytics} aria-describedby="cookie-analytics-description" />
        </section>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <footer className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => save(false)}>Reject optional</Button>
          <Button type="button" onClick={() => save(analytics)}>Save preferences</Button>
        </footer>
      </DialogContent>
    </Dialog>
  </>
}
