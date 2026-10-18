'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { sendEmailVerification } from 'firebase/auth'
import { CreditCard, Gauge, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendUsage } from '@/lib/backend/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import styles from './settings-dialog.module.css'

type SettingsPage = 'account' | 'usage' | 'billing'
type SettingsSection = { label: string; description: string; icon: LucideIcon }

const SETTINGS_SECTIONS: Record<SettingsPage, SettingsSection> = {
  account: {
    label: 'Account',
    description: 'Manage your profile and privacy choices.',
    icon: UserRound,
  },
  usage: {
    label: 'Usage',
    description: 'See how your workspace uses its current limits.',
    icon: Gauge,
  },
  billing: {
    label: 'Subscription',
    description: 'Review your plan and manage billing details.',
    icon: CreditCard,
  },
}

const SETTINGS_SECTION_ORDER: SettingsPage[] = ['account', 'usage', 'billing']

const RESET_LABELS = {
  NEVER: 'Does not reset',
  DAILY: 'Resets daily',
  MONTHLY: 'Resets monthly',
} as const

type SettingsContext = { openSettings: () => void; closeSettings: () => void }
const Context = createContext<SettingsContext | null>(null)

export function useSettingsDialog() {
  const value = useContext(Context)
  if (!value) throw new Error('SettingsDialogProvider is missing.')
  return value
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

type UsageMeterProps = { meter: BackendUsage['meters'][number] }

function UsageMeter({ meter }: UsageMeterProps) {
  const hasLimit = meter.hardLimit > 0
  const isAtLimit = hasLimit && meter.totalUsed >= meter.hardLimit
  const progress = hasLimit ? Math.min((meter.totalUsed / meter.hardLimit) * 100, 100) : null

  return (
    <section className="py-6 first:pt-0" aria-labelledby={`usage-${meter.meterKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`usage-${meter.meterKey}`} className="text-sm font-semibold">{meter.label}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Period started {new Date(meter.periodStart).toLocaleDateString()} · {RESET_LABELS[meter.resetPeriod]}
          </p>
        </div>
        {isAtLimit && (
          <span className="rounded-md bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-soft-foreground">
            Limit reached
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{meter.totalUsed.toLocaleString()}</span>
          {hasLimit ? (
            <span className="ml-2 text-sm text-muted-foreground">
              of {meter.hardLimit.toLocaleString()} {meter.unit}
            </span>
          ) : (
            <span className="ml-2 text-sm text-muted-foreground">{meter.unit} used</span>
          )}
        </p>
        {progress !== null && (
          <p className="text-xs tabular-nums text-muted-foreground">{Math.round(progress)}% used</p>
        )}
      </div>

      {progress !== null && (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${meter.label} usage`}
          aria-valuemin={0}
          aria-valuemax={meter.hardLimit}
          aria-valuenow={Math.min(meter.totalUsed, meter.hardLimit)}
          aria-valuetext={`${meter.totalUsed.toLocaleString()} of ${meter.hardLimit.toLocaleString()} ${meter.unit}`}
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed tabular-nums text-muted-foreground">
        {meter.consumed.toLocaleString()} consumed
        <span aria-hidden="true"> · </span>
        {meter.reserved.toLocaleString()} reserved
      </p>
    </section>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const { user, account, usage, accountError, refreshAccount } = useAuth()
  const [page, setPage] = useState<SettingsPage>('account')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeSection = SETTINGS_SECTIONS[page]

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${styles.dialog} relative my-0 flex h-[calc(100dvh-2rem)] w-full max-w-full flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 sm:h-[min(85dvh,700px)] sm:max-w-4xl`}>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside className="flex shrink-0 flex-col border-b border-border/70 bg-background sm:w-52 sm:border-b-0 sm:border-r">
            <div className="px-5 pb-5 pt-7 pr-16 sm:px-6 sm:pb-8 sm:pt-8">
              <DialogTitle className="text-base font-semibold tracking-tight">Settings</DialogTitle>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 sm:flex-col sm:overflow-x-visible sm:px-3 sm:pb-4" aria-label="Settings sections">
              {SETTINGS_SECTION_ORDER.map((item) => {
                const { icon: Icon, label } = SETTINGS_SECTIONS[item]
                return (
                  <button
                    key={item}
                    type="button"
                    aria-current={page === item ? 'page' : undefined}
                    onClick={() => {
                      setPage(item)
                      setMessage(null)
                      setError(null)
                    }}
                    className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      page === item
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </nav>
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-7 sm:px-8 sm:py-10" aria-busy={busy}>
            <header className="mb-7 border-b border-border/70 pb-6 sm:pr-8">
              <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[28px]">{activeSection.label}</h2>
              <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeSection.description}</DialogDescription>
            </header>

            {(error || accountError) && (
              <p role="alert" className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error || accountError}
              </p>
            )}
            {message && (
              <p role="status" className="mb-5 rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed">
                {message}
              </p>
            )}

            {!account ? (
              <div className="py-6">
                <UserRound className="mb-4 size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="text-base font-semibold">Account details unavailable</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your account details could not be loaded. Reconnect to try again.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  disabled={busy}
                  onClick={() => void perform(refreshAccount)}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : (
              <>
                {page === 'account' && (
                  <div className="space-y-7">
                    <section className="flex items-center gap-4">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-xl font-semibold" aria-hidden="true">
                        {(account.displayName || account.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight">{account.displayName || 'Your account'}</h3>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{account.email}</p>
                      </div>
                    </section>

                    <dl className="divide-y divide-border/70 border-y border-border/70">
                      <div className="flex flex-col gap-2 py-5 md:flex-row md:justify-between md:gap-5">
                        <dt className="shrink-0 text-sm text-muted-foreground">Email address</dt>
                        <dd className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium md:justify-end">
                          <span className="break-all">{account.email}</span>
                          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">
                            {account.emailVerified ? 'Verified' : 'Not verified'}
                          </span>
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-5 py-5">
                        <dt className="text-sm text-muted-foreground">Projects</dt>
                        <dd className="text-sm font-semibold tabular-nums">{account.projectCount.toLocaleString()}</dd>
                      </div>
                    </dl>

                    {!account.emailVerified && (
                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold">Verify your email</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Verify your email address to keep your account information up to date.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => void perform(async () => {
                              if (!user) throw new Error('Sign in first.')
                              await sendEmailVerification(user)
                              setMessage('Verification email sent.')
                            })}
                          >
                            Send verification email
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void perform(async () => {
                              if (!user) throw new Error('Sign in first.')
                              await user.reload()
                              await user.getIdToken(true)
                              await refreshAccount()
                            })}
                          >
                            I have verified my email
                          </Button>
                        </div>
                      </section>
                    )}

                    <section className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">Privacy and data</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          Erasure requests are reviewed before deletion. Submitting a request does not delete your account.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void perform(async () => {
                          const result = await currentBackend().requestErasure()
                          setMessage(`${result.message} Reference: ${result.request.reference}`)
                        })}
                      >
                        Request account erasure
                      </Button>
                    </section>
                  </div>
                )}

                {page === 'usage' && (
                  <div className="space-y-6">
                    {usage ? (
                      usage.meters.length > 0 ? (
                        <div className="divide-y divide-border/70">
                          {usage.meters.map((meter) => <UsageMeter key={meter.meterKey} meter={meter} />)}
                        </div>
                      ) : (
                        <p className="py-6 text-sm leading-relaxed text-muted-foreground">
                          No usage data is available yet.
                        </p>
                      )
                    ) : (
                      <p role="alert" className="py-6 text-sm leading-relaxed text-muted-foreground">
                        Usage data is unavailable. Refresh your account to try again.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void perform(refreshAccount)}
                    >
                      <RefreshCw aria-hidden="true" />
                      Refresh usage
                    </Button>
                  </div>
                )}

                {page === 'billing' && (
                  <div className="space-y-7">
                    <section className="border-b border-border/70 pb-7">
                      <p className="text-xs font-medium text-muted-foreground">Current plan</p>
                      <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{account.plan.name}</h3>
                      {account.subscriptionStatus && (
                        <p className="mt-3 text-sm text-muted-foreground">{account.subscriptionStatus}</p>
                      )}
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">Manage your subscription</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Open your billing portal to manage billing details and your subscription.
                      </p>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => void perform(async () => {
                            const result = await currentBackend().billingPortal()
                            window.location.assign(result.url)
                          })}
                        >
                          <CreditCard aria-hidden="true" />
                          Manage billing
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/pricing" onClick={() => onOpenChange(false)}>
                            Compare plans
                          </Link>
                        </Button>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
