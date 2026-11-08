'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendPlan, BackendSubscription } from '@/lib/backend/client'
import { longDate } from '@/lib/settings/plans'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SettingsPanel, type SettingsPage } from './settings-panel'
import { PlanChangeDialog, type PlanChangeRequest } from './plan-change-dialog'
import { CloseAccountDialog } from './close-account-dialog'
import styles from './settings-dialog.module.css'

type SettingsContext = { openSettings: (page?: SettingsPage) => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)

export function useSettingsDialog() {
  const context = useContext(Context)
  if (!context) throw new Error('useSettingsDialog must be used within SettingsDialogProvider')
  return context
}

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialPage, setInitialPage] = useState<SettingsPage>('account')
  const openSettings = useCallback((page: SettingsPage = 'account') => { setInitialPage(page); setOpen(true) }, [])
  const closeSettings = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings])

  return (
    <Context.Provider value={value}>
      {children}
      <SettingsDialog open={open} onOpenChange={setOpen} initialPage={initialPage} />
    </Context.Provider>
  )
}

/**
 * Settings as a modal over whatever the user is doing. The surface follows the
 * surrounding theme; the panel inside knows nothing of auth or the backend,
 * which stay here with the busy/message/error state they produce.
 */
export function SettingsDialog({ open, onOpenChange, initialPage = 'account' }: { open: boolean; onOpenChange: (value: boolean) => void; initialPage?: SettingsPage }) {
  const { user, account, usage, accountError, refreshAccount } = useAuth()
  const [page, setPage] = useState<SettingsPage>(initialPage)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<readonly BackendPlan[] | null>(null)
  // undefined: not loaded yet; null: the server says there is no subscription.
  const [subscription, setSubscription] = useState<BackendSubscription | null | undefined>(undefined)
  const [planChange, setPlanChange] = useState<PlanChangeRequest | null>(null)
  const [closingAccount, setClosingAccount] = useState(false)

  useEffect(() => { if (open) setPage(initialPage) }, [open, initialPage])

  // Plans and the live subscription are server state, read when the Plan page is shown and after every change.
  const [billingRevision, setBillingRevision] = useState(0)
  useEffect(() => {
    if (!open || page !== 'plan' || account === null) return
    const controller = new AbortController()
    void (async () => {
      try {
        const [catalogue, live] = await Promise.all([currentBackend().plans(controller.signal), currentBackend().subscription(controller.signal)])
        if (controller.signal.aborted) return
        setPlans(catalogue.plans); setSubscription(live.subscription)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Plans could not be loaded.')
      }
    })()
    return () => controller.abort()
  }, [open, page, account, billingRevision])
  const reloadBilling = async () => { await refreshAccount(); setBillingRevision((value) => value + 1) }

  const perform = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await work()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The operation failed.')
    } finally {
      setBusy(false)
    }
  }
  const changePage = (next: SettingsPage) => { setPage(next); setMessage(null); setError(null) }
  const previewPlanChange = useCallback((planKey: string) => currentBackend().previewPlanChange(planKey), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${styles.dialog} relative my-0 flex h-[calc(100dvh-2rem)] w-full max-w-full flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0 text-foreground sm:h-[min(88dvh,760px)] sm:max-w-5xl`}>
        <SettingsPanel
          page={page}
          onPageChange={changePage}
          account={account}
          usage={usage}
          busy={busy}
          message={message}
          error={error || accountError}
          title={<DialogTitle className="text-base font-semibold tracking-tight">Settings</DialogTitle>}
          description={(text) => <DialogDescription className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{text}</DialogDescription>}
          verification={account && !account.emailVerified ? (
            <EmailCodeVerification email={user?.email ?? account.email} autoSend={false} onVerified={() => setMessage('Email verified.')} />
          ) : undefined}
          onRefresh={() => void perform(refreshAccount)}
          plan={{
            plans,
            subscription,
            onManageBilling: () => void perform(async () => {
              const result = await currentBackend().billingPortal()
              window.location.assign(result.url)
            }),
            onSubscribe: (plan) => void perform(async () => {
              const result = await currentBackend().checkout(plan.key)
              window.location.assign(result.url)
            }),
            onChangePlan: (plan, relation) => { setError(null); setMessage(null); setPlanChange({ plan, relation }) },
            onSetCancellation: (cancelAtPeriodEnd) => void perform(async () => {
              const result = await currentBackend().setCancellation(cancelAtPeriodEnd)
              await reloadBilling()
              setMessage(cancelAtPeriodEnd
                ? `Your plan ends on ${longDate(result.subscription.currentPeriodEnd)}. You keep everything it includes until then.`
                : 'Your plan continues and renews as before.')
            }),
          }}
          onCloseAccount={() => { setError(null); setMessage(null); setClosingAccount(true) }}
          onKeepAccount={() => void perform(async () => {
            await currentBackend().keepAccount()
            await refreshAccount()
            setMessage('Your account stays open. Nothing was deleted.')
          })}
        />
        <PlanChangeDialog
          request={planChange}
          busy={busy}
          preview={previewPlanChange}
          onClose={() => setPlanChange(null)}
          onConfirm={(plan) => void perform(async () => {
            const result = await currentBackend().changePlan(plan.key)
            setPlanChange(null)
            await reloadBilling()
            setMessage(`You are now on ${plan.name}. It renews on ${longDate(result.subscription.currentPeriodEnd)}.`)
          })}
        />
        {account && (
          <CloseAccountDialog
            open={closingAccount}
            email={account.email}
            busy={busy}
            graceDays={30}
            onClose={() => setClosingAccount(false)}
            onConfirm={(confirmation) => void perform(async () => {
              const result = await currentBackend().closeAccount(confirmation)
              setClosingAccount(false)
              await refreshAccount()
              setMessage(`Your account closes on ${longDate(result.closure.closesAt)}. Until then you can keep it from this page.`)
            })}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
