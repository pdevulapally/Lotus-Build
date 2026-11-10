'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Cpu, CreditCard, Gauge, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { settingsSessionId } from '@/lib/settings/models'
import { useSettingsSnapshot } from '@/hooks/use-settings-snapshot'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AccountUsage, SessionUsage } from './usage-panel'
import { ModelsPanel } from './models-panel'
import { AccountPanel, BillingPanel } from './account-panel'
import styles from './settings-dialog.module.css'

export type SettingsPage = 'account' | 'models' | 'usage' | 'billing'
type SettingsSection = { label: string; description: string; icon: LucideIcon }
const sections: Record<SettingsPage, SettingsSection> = {
  account: { label: 'Account', description: 'Your profile, privacy and account details.', icon: UserRound },
  models: { label: 'AI models', description: 'See which model your session uses and what is available.', icon: Cpu },
  usage: { label: 'Usage', description: 'A clear view of your usage and plan limits.', icon: Gauge },
  billing: { label: 'Plan & billing', description: 'Your current plan and billing options.', icon: CreditCard },
}
const sectionOrder: SettingsPage[] = ['account', 'models', 'usage', 'billing']
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
  const [scope, setScope] = useState<'account' | 'session'>('account')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const snapshot = useSettingsSnapshot(open, user?.uid, sessionId, refreshAccount)
  const activeSection = sections[page]
  const contentRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) { setPage(initialPage); setScope('account'); setMessage(null); setError(null) }
  }, [open, initialPage])
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }) }, [page, scope])

  const perform = async (work: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError(null); setMessage(null)
    try { await work() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The operation failed.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent overlayClassName="bg-black/50" className={`${styles.dialog} my-0 flex h-[calc(100dvh-2rem)] w-full max-w-full flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground sm:h-[min(85dvh,720px)] sm:max-w-4xl`}
      onCloseAutoFocus={onRestoreFocus ? (event) => { event.preventDefault(); onRestoreFocus() } : undefined}>
      <section className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-border/60 bg-background sm:w-52 sm:border-b-0 sm:border-r">
          <header className="px-5 pb-4 pr-16 pt-6 sm:px-5 sm:pb-6 sm:pt-8">
            <DialogTitle className="text-base font-semibold tracking-tight">Settings</DialogTitle>
            {account && <p className="mt-2 truncate text-xs text-muted-foreground">{account.plan.name} plan</p>}
          </header>
          <nav className="grid grid-cols-2 gap-1 px-3 pb-3 sm:flex sm:flex-col" aria-label="Settings sections">
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
          <section ref={contentRef} id="settings-content" aria-labelledby="settings-section-title" aria-busy={busy || snapshot.refreshing} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/60 px-5 py-6 sm:px-8">
            {(error || accountError) && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error || accountError}</p>}
            {message && <p role="status" className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}
            {!account ? <section className="py-6">
              <h3 className="text-base font-semibold">{loading || snapshot.refreshing ? 'Loading your account…' : 'Account details unavailable'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{loading || snapshot.refreshing ? 'Checking your latest plan, models and usage.' : 'Refresh to try loading your account again.'}</p>
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

              {page === 'models' && <ModelsPanel account={account} sessionId={sessionId} session={snapshot.session} error={snapshot.sessionError} loading={snapshot.refreshing} />}

              {page === 'usage' && <section className="space-y-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">{usage?.plan.name ?? account.plan.name} plan</p>
                  {sessionId && (
                    <fieldset className="flex rounded-lg bg-muted p-1" aria-label="Usage scope">
                      <legend className="sr-only">Usage scope</legend>
                      {(['account', 'session'] as const).map((item) => (
                        <label key={item} className={`cursor-pointer rounded-md px-3 py-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring ${scope === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                          <input type="radio" className="sr-only" name="settings-usage-scope" checked={scope === item} onChange={() => setScope(item)} />
                          {item === 'account' ? 'Account' : 'This session'}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </header>
                {scope === 'session' && sessionId ? <SessionUsage usage={snapshot.usage} error={snapshot.usageError} loading={snapshot.refreshing} /> : <AccountUsage usage={usage} />}
              </section>}

              {page === 'billing' && <BillingPanel
                account={account}
                busy={busy}
                onBilling={() => void perform(async () => {
                  const result = await currentBackend().billingPortal()
                  window.location.assign(result.url)
                })}
                onClose={() => onOpenChange(false)}
              />}
            </>}
          </section>
          <footer className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 sm:px-8">
            <p role="status" className="text-xs text-muted-foreground">{snapshot.refreshing ? 'Updating…' : snapshot.updatedAt ? `Account updated ${snapshot.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Latest details unavailable'}</p>
            <Button type="button" variant="ghost" disabled={busy || snapshot.refreshing} onClick={() => void snapshot.refresh()}><RefreshCw className={snapshot.refreshing ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />Refresh</Button>
          </footer>
        </section>
      </section>
    </DialogContent>
  </Dialog>
}
