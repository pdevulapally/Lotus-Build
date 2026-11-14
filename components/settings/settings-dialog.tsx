'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { useBillingSummary } from '@/hooks/use-billing-summary'
import { useBillingPortal } from '@/hooks/use-billing-portal'
import { useSettingsSnapshot } from '@/hooks/use-settings-snapshot'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text, Heading } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { SettingsShell, type SettingsPage } from './settings-shell'
export type { SettingsPage } from './settings-shell'
import { CreditsPanel } from './credits-panel'
import { useCredits } from '@/hooks/use-credits'
import { useSupportAccess } from '@/hooks/use-support-access'
import { AccountUsage } from './usage-panel'
import { AccountPanel } from './account-panel'
import { BillingPanel } from './billing-panel'
import { PluginsPanel } from './plugins-panel'
import { CreditBalance } from '@/components/billing/credit-balance'
import type { CreditTask } from '@/lib/billing/credits'
type SettingsOpenOptions = { purchaseId?: string | null; continuation?: CreditTask }
type SettingsContext = { openSettings: (page?: SettingsPage, options?: SettingsOpenOptions) => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)

export function useSettingsDialog() {
  const value = useContext(Context)
  if (!value) throw new Error('SettingsDialogProvider is missing.')
  return value
}

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialPage, setInitialPage] = useState<SettingsPage>('account')
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [continuation, setContinuation] = useState<CreditTask | undefined>()
  const opener = useRef<HTMLElement | null>(null)
  const openSettings = useCallback((page: SettingsPage = 'account', options?: SettingsOpenOptions) => {
    opener.current = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-trigger"][data-state="open"]')
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setInitialPage(page)
    setPurchaseId(options?.purchaseId ?? null)
    setContinuation(options?.continuation)
    setOpen(true)
  }, [])
  const closeSettings = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings])
  return <Context.Provider value={value}>
    {children}
    <SettingsDialog open={open} onOpenChange={setOpen} initialPage={initialPage} purchaseId={purchaseId} continuation={continuation} onRestoreFocus={() => {
      if (opener.current?.isConnected) opener.current.focus()
    }} />
  </Context.Provider>
}

export function SettingsDialog({ open, onOpenChange, initialPage = 'account', purchaseId, continuation, onRestoreFocus }: {
  open: boolean; onOpenChange: (value: boolean) => void; initialPage?: SettingsPage; purchaseId?: string | null; continuation?: CreditTask; onRestoreFocus?: () => void
}) {
  const { user, account, usage, accountError, refreshAccount, loading } = useAuth()
  const [page, setPage] = useState<SettingsPage>(initialPage)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const snapshot = useSettingsSnapshot(open, user?.uid, null, refreshAccount)
  const billing = useBillingSummary(open && page === 'billing' ? user?.uid : undefined)
  const portal = useBillingPortal(open && page === 'billing' ? user?.uid : undefined)
  const creditsVisible = page === 'on-demand' || page === 'usage' || page === 'billing'
  const support = useSupportAccess(open && page === 'account' ? user?.uid : undefined)
  const credits = useCredits(open && creditsVisible ? user?.uid : undefined, purchaseId, continuation)
  useEffect(() => {
    if (open) { setPage(initialPage); setMessage(null); setError(null) }
  }, [open, initialPage])
  const perform = async (work: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError(null); setMessage(null)
    try { await work() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The operation failed.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <SettingsShell open={open} onOpenChange={onOpenChange} page={page}
    onPageChange={next => { setPage(next); setMessage(null); setError(null) }} onRestoreFocus={onRestoreFocus}
    busy={busy || portal.busy || snapshot.refreshing || (page === 'billing' && billing.loading) || (creditsVisible && (credits.loading || credits.busy))}
    footer={<HStack as="footer" gap={2} align="center" justify="between" wrap="wrap" paddingInline={4} paddingBlock={2}>
      <Text type="supporting" color="secondary" role="status">{snapshot.refreshing ? 'Updating...' : snapshot.updatedAt ? `Account updated ${snapshot.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Latest details unavailable'}</Text>
      <Button label="Refresh" variant="ghost" size="sm" isDisabled={busy || portal.busy || snapshot.refreshing || (creditsVisible && (credits.loading || credits.busy))}
        onClick={() => { void snapshot.refresh(); if (creditsVisible) void credits.refresh(); if (page === 'billing') void billing.refresh(); if (page === 'account') void support.refresh() }}
        icon={<RefreshCw className={snapshot.refreshing ? 'size-4 motion-safe:animate-spin' : 'size-4'} aria-hidden="true" />} />
    </HStack>}>
    {(error || accountError || portal.error) && <Text type="body" role="alert" className="text-destructive">{error || accountError || portal.error}</Text>}
    {message && <Text type="body" role="status">{message}</Text>}
    {!account ? <VStack gap={2}>
      <Heading level={4}>{loading || snapshot.refreshing ? 'Loading your account…' : 'Account details unavailable'}</Heading>
      <Text type="supporting" color="secondary">{loading || snapshot.refreshing ? 'Checking your latest plan and usage.' : 'Refresh to try loading your account again.'}</Text>
    </VStack> : <>
      {page === 'account' && <AccountPanel
        account={account}
        email={user?.email ?? account.email}
        displayName={user?.displayName}
        photoURL={user?.photoURL}
        busy={busy}
        support={support}
        onVerified={() => setMessage('Email verified.')}
        onErasure={() => void perform(async () => {
          const result = await currentBackend().requestErasure()
          setMessage(`${result.message} Reference: ${result.request.reference}`)
        })}
      />}

      {page === 'usage' && <AccountUsage usage={usage} onManagePlan={() => setPage('billing')}
        onDemand={<CreditBalance credits={credits} onBuy={() => setPage('on-demand')} />} />}

      {page === 'on-demand' && <CreditsPanel key={user?.uid} credits={credits} task={continuation} onClose={() => onOpenChange(false)} />}

      {page === 'billing' && <BillingPanel account={account} summary={billing} credits={credits}
        portal={{ available: credits.data?.portalAvailable, loading: credits.loading, busy: portal.busy, onOpen: () => { void portal.open() } }}
        onOpenCredits={() => setPage('on-demand')} onClose={() => onOpenChange(false)} />}
      {page === 'plugins' && <PluginsPanel key={user?.uid} />}

    </>}
  </SettingsShell>
}
