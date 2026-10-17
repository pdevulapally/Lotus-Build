"use client"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { sendEmailVerification } from 'firebase/auth'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type SettingsContext = { openSettings: () => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)
export function useSettingsDialog() { const value = useContext(Context); if (!value) throw new Error('SettingsDialogProvider is missing.'); return value }
export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openSettings = useCallback(() => setOpen(true), []); const closeSettings = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings])
  return <Context.Provider value={value}>{children}<SettingsDialog open={open} onOpenChange={setOpen} /></Context.Provider>
}
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const { user, account, usage, accountError, refreshAccount } = useAuth()
  const [page, setPage] = useState<'account' | 'usage' | 'billing'>('account')
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const perform = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(null); setMessage(null)
    try { await work() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The operation failed.') }
    finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:h-[min(85dvh,760px)] sm:max-w-4xl">
      <div className="border-b border-border/70 px-5 py-4 pr-14 sm:px-6"><DialogTitle>Settings</DialogTitle></div>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="flex gap-1 border-b border-border px-3 py-3 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r" aria-label="Account settings">
          {(['account', 'usage', 'billing'] as const).map((item) => <button key={item} type="button" aria-current={page === item ? 'page' : undefined}
            onClick={() => { setPage(item); setMessage(null); setError(null) }}
            className={`rounded-lg px-3 py-2 text-left text-sm capitalize ${page === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{item}</button>)}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {(error || accountError) && <p role="alert" className="mb-4 text-sm text-destructive">{error || accountError}</p>}
          {message && <p role="status" className="mb-4 text-sm">{message}</p>}
          {!account ? <button type="button" className="underline" onClick={() => void perform(refreshAccount)}>Retry account connection</button> : <>
            {page === 'account' && <div className="space-y-6">
              <div><h2 className="text-base font-semibold">Profile</h2><p className="mt-2 text-sm">{account.email}</p>{account.displayName && <p className="text-sm text-muted-foreground">{account.displayName}</p>}</div>
              <div><p className="text-sm">Email {account.emailVerified ? 'verified' : 'not verified'}</p>
                {!account.emailVerified && <div className="mt-2 flex gap-4 text-sm">
                  <button type="button" disabled={busy} className="underline" onClick={() => void perform(async () => { if (!user) throw new Error('Sign in first.'); await sendEmailVerification(user); setMessage('Verification email sent.') })}>Send verification email</button>
                  <button type="button" disabled={busy} className="underline" onClick={() => void perform(async () => { if (!user) throw new Error('Sign in first.'); await user.reload(); await user.getIdToken(true); await refreshAccount() })}>I have verified my email</button>
                </div>}
              </div>
              <div><h2 className="text-base font-semibold">Privacy</h2><p className="mt-2 text-sm text-muted-foreground">Erasure requests are reviewed before deletion. Submitting a request does not delete your account.</p>
                <button type="button" disabled={busy} className="mt-3 text-sm underline" onClick={() => void perform(async () => { const result = await currentBackend().requestErasure(); setMessage(`${result.message} Reference: ${result.request.reference}`) })}>Request account erasure</button>
              </div>
            </div>}
            {page === 'usage' && <div className="space-y-5"><h2 className="text-base font-semibold">Account usage</h2>
              {!usage ? <p role="alert">Usage data is unavailable.</p> : usage.meters.map((meter) => <div key={meter.meterKey} className="border-b border-border pb-4">
                <p className="text-sm font-medium">{meter.label}</p><p className="mt-1 text-sm text-muted-foreground">{meter.consumed.toLocaleString()} consumed · {meter.reserved.toLocaleString()} reserved · {meter.hardLimit.toLocaleString()} {meter.unit} limit</p>
                <p className="mt-1 text-xs text-muted-foreground">Period starts {new Date(meter.periodStart).toLocaleDateString()} · {meter.resetPeriod.toLowerCase()}</p>
              </div>)}<button type="button" disabled={busy} className="text-sm underline" onClick={() => void perform(refreshAccount)}>Refresh usage</button>
            </div>}
            {page === 'billing' && <div className="space-y-5"><h2 className="text-base font-semibold">{account.plan.name}</h2>
              {account.subscriptionStatus && <p className="text-sm">{account.subscriptionStatus}</p>}
              <button type="button" disabled={busy} className="text-sm underline" onClick={() => void perform(async () => { const result = await currentBackend().billingPortal(); window.location.assign(result.url) })}>Open billing portal</button>
              <p><Link href="/pricing" onClick={() => onOpenChange(false)} className="text-sm underline">View available plans</Link></p>
            </div>}
          </>}
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
