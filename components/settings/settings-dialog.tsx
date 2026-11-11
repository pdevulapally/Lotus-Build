'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { CreditCard, Gauge, RefreshCw, UserRound, Zap, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { settingsSessionId } from '@/lib/settings/models'
import { useBillingSummary } from '@/hooks/use-billing-summary'
import { useSettingsSnapshot } from '@/hooks/use-settings-snapshot'
import { SettingsButton as Button } from '@/components/settings/settings-button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CreditsPanel } from './credits-panel'
import { useCredits } from '@/hooks/use-credits'
import { AccountUsage, SessionUsage } from './usage-panel'
import { AccountPanel } from './account-panel'
import { BillingPanel } from './billing-panel'
import styles from './settings-dialog.module.css'

export type SettingsPage = 'account' | 'usage' | 'billing' | 'on-demand'
type SettingsSection = { label: string; description: string; icon: LucideIcon }
const sections: Record<SettingsPage, SettingsSection> = {
  account: { label: 'Account', description: 'Your profile, privacy and account details.', icon: UserRound },
  usage: { label: 'Usage', description: 'Your plan allowance and when it resets.', icon: Gauge },
  'on-demand': { label: 'On-demand usage', description: 'Extra AI credits and one-time top-ups.', icon: Zap },
  billing: { label: 'Plan & billing', description: 'Your subscription, payment details and invoices.', icon: CreditCard },
}
const sectionOrder: SettingsPage[] = ['account', 'billing', 'usage', 'on-demand']
type SettingsContext = { openSettings: (page?: SettingsPage) => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)

export function useSettingsDialog() {
  const value = useContext(Context)
  if (!value) throw new Error('SettingsDialogProvider is missing.')
  return value
}

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialPage, setInitialPage] = useState<SettingsPage>('account')
  const opener = useRef<HTMLElement | null>(null)
  const openSettings = useCallback((page: SettingsPage = 'account') => {
    opener.current = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-trigger"][data-state="open"]')
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setInitialPage(page)
    setOpen(true)
  }, [])
  const closeSettings = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings])
  return <Context.Provider value={value}>
    {children}
    <SettingsDialog open={open} onOpenChange={setOpen} initialPage={initialPage} onRestoreFocus={() => {
      if (opener.current?.isConnected) opener.current.focus()
    }} />
  </Context.Provider>
}

export function SettingsDialog({ open, onOpenChange, initialPage = 'account', onRestoreFocus }: {
  open: boolean; onOpenChange: (value: boolean) => void; initialPage?: SettingsPage; onRestoreFocus?: () => void
}) {
  const { user, account, usage, accountError, refreshAccount, loading } = useAuth()
  const pathname = usePathname()
  const sessionId = settingsSessionId(pathname)
  const [page, setPage] = useState<SettingsPage>(initialPage)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const snapshot = useSettingsSnapshot(open, user?.uid, sessionId, refreshAccount)
  const billing = useBillingSummary(open && page === 'billing' ? user?.uid : undefined)
  const creditsVisible = page === 'on-demand'
  const credits = useCredits(open && creditsVisible ? user?.uid : undefined)
  const activeSection = sections[page]
  const contentRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) { setPage(initialPage); setMessage(null); setError(null) }
  }, [open, initialPage])
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }) }, [page])

  const perform = async (work: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError(null); setMessage(null)
    try { await work() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The operation failed.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent overlayClassName="bg-black/50" className={`${styles.dialog} my-0 flex h-[calc(100dvh-2rem)] w-full max-w-full flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground sm:h-[min(85dvh,680px)] sm:max-w-5xl`}
      onCloseAutoFocus={onRestoreFocus ? (event) => { event.preventDefault(); onRestoreFocus() } : undefined}>
      <section className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-border/60 bg-background sm:w-52 sm:border-b-0 sm:border-r">
          <header className="px-5 pb-4 pr-16 pt-6 sm:px-5 sm:pb-6 sm:pt-8">
            <DialogTitle className="text-base font-semibold tracking-tight">Settings</DialogTitle>
            {account && <p className="mt-2 truncate text-xs text-muted-foreground">{account.plan.name} plan</p>}
          </header>
          <nav className="flex flex-wrap gap-1 px-3 pb-3 sm:flex sm:flex-col" aria-label="Settings sections">
            {sectionOrder.map((item) => {
              const { icon: Icon, label } = sections[item]
              return <button key={item} type="button" aria-current={page === item ? 'page' : undefined} aria-controls="settings-content"
                onClick={() => { setPage(item); setMessage(null); setError(null) }}
                className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${page === item ? 'bg-muted font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Icon className="size-4 shrink-0" aria-hidden="true" />{label}
              </button>
            })}
          </nav>
          {account && <p className="mt-auto hidden truncate px-5 py-5 text-xs text-muted-foreground sm:block" title={account.email}>{account.email}</p>}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 px-5 pb-5 pt-6 sm:px-8 sm:pr-16 sm:pt-8">
            <h2 id="settings-section-title" className="text-xl font-semibold tracking-tight">{activeSection.label}</h2>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeSection.description}</DialogDescription>
          </header>
          <section ref={contentRef} id="settings-content" aria-labelledby="settings-section-title" aria-busy={busy || snapshot.refreshing || (page === 'billing' && billing.loading) || (creditsVisible && (credits.loading || credits.busy))} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/60 px-5 py-6 sm:px-8">
            {(error || accountError) && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error || accountError}</p>}
            {message && <p role="status" className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}
            {!account ? <section className="py-6">
              <h3 className="text-base font-semibold">{loading || snapshot.refreshing ? 'Loading your account…' : 'Account details unavailable'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{loading || snapshot.refreshing ? 'Checking your latest plan and usage.' : 'Refresh to try loading your account again.'}</p>
            </section> : <>
              {page === 'account' && <AccountPanel
                account={account}
                email={user?.email ?? account.email}
                busy={busy}
                onVerified={() => setMessage('Email verified.')}
                onErasure={() => void perform(async () => {
                  const result = await currentBackend().requestErasure()
                  setMessage(`${result.message} Reference: ${result.request.reference}`)
                })}
              />}

              {page === 'usage' && <section className="space-y-6">
                <Button variant="outline" onClick={() => setPage('on-demand')}>View on-demand usage</Button>
                <AccountUsage usage={usage} onNavigate={() => onOpenChange(false)} />
                {sessionId && <details className="border-t border-border/60 pt-4">
                  <summary className="cursor-pointer rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">This session</summary>
                  <section className="pt-3"><SessionUsage usage={snapshot.usage} error={snapshot.usageError} loading={snapshot.refreshing} /></section>
                </details>}
              </section>}

              {page === 'on-demand' && <CreditsPanel key={user?.uid} credits={credits} />}

              {page === 'billing' && <BillingPanel account={account} summary={billing} onOpenCredits={() => setPage('on-demand')} onClose={() => onOpenChange(false)} />}

            </>}
          </section>
          <footer className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 sm:px-8">
            <p role="status" className="text-xs text-muted-foreground">{snapshot.refreshing ? 'Updating…' : snapshot.updatedAt ? `Account updated ${snapshot.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Latest details unavailable'}</p>
            <Button type="button" variant="ghost" disabled={busy || snapshot.refreshing || (creditsVisible && (credits.loading || credits.busy))} onClick={() => { void snapshot.refresh(); if (creditsVisible) void credits.refresh(); if (page === 'billing') void billing.refresh() }}><RefreshCw className={snapshot.refreshing ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />Refresh</Button>
          </footer>
        </section>
      </section>
    </DialogContent>
  </Dialog>
}

