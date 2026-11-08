'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SettingsPanel, type SettingsPage } from './settings-panel'
import styles from './settings-dialog.module.css'

type SettingsContext = { openSettings: () => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)

export function useSettingsDialog() {
  const context = useContext(Context)
  if (!context) throw new Error('useSettingsDialog must be used within SettingsDialogProvider')
  return context
}

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openSettings = useCallback(() => setOpen(true), [])
  const closeSettings = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings])

  return (
    <Context.Provider value={value}>
      {children}
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </Context.Provider>
  )
}

/**
 * Settings as a modal over whatever the user is doing. The surface follows the
 * surrounding theme; the panel inside knows nothing of auth or the backend,
 * which stay here with the busy/message/error state they produce.
 */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const { user, account, usage, accountError, refreshAccount } = useAuth()
  const router = useRouter()
  const [page, setPage] = useState<SettingsPage>('account')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          onManageBilling={() => void perform(async () => {
            const result = await currentBackend().billingPortal()
            window.location.assign(result.url)
          })}
          onComparePlans={() => { onOpenChange(false); router.push('/pricing') }}
          onRequestErasure={() => void perform(async () => {
            const result = await currentBackend().requestErasure()
            setMessage(`${result.message} Reference: ${result.request.reference}`)
          })}
        />
      </DialogContent>
    </Dialog>
  )
}
