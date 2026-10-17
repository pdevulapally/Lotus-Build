'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { sendEmailVerification } from 'firebase/auth'
import { CreditCard, Gauge, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendUsage } from '@/lib/backend/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

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
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby={`usage-${meter.meterKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`usage-${meter.meterKey}`} className="font-medium">{meter.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Period started {new Date(meter.periodStart).toLocaleDateString()} · {RESET_LABELS[meter.resetPeriod]}
          </p>
        </div>
        {isAtLimit && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
            Limit reached
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="text-2xl font-semibold tracking-tight">{meter.totalUsed.toLocaleString()}</span>
          {hasLimit ? (
            <span className="ml-2 text-sm text-muted-foreground">
              of {meter.hardLimit.toLocaleString()} {meter.unit}
            </span>
          ) : (
            <span className="ml-2 text-sm text-muted-foreground">{meter.unit} used</span>
          )}
        </p>
        {progress !== null && (
          <p className="text-sm text-muted-foreground">{Math.round(progress)}% used</p>
        )}
      </div>

      {progress !== null && (
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
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

      <p className="mt-4 text-sm text-muted-foreground">
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
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:h-[min(85dvh,760px)] sm:max-w-5xl">
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside className="flex shrink-0 flex-col border-b border-border sm:w-56 sm:border-b-0 sm:border-r">
            <div className="px-5 py-5 pr-14 sm:pr-5">
              <DialogTitle className="text-base">Settings</DialogTitle>
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
                    className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            <header className="mb-7 pr-10">
              <h2 className="text-xl font-semibold tracking-tight">{activeSection.label}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{activeSection.description}</p>
            </header>

            {(error || accountError) && (
              <p role="alert" className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error || accountError}
              </p>
            )}
            {message && (
              <p role="status" className="mb-5 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
                {message}
              </p>
            )}

            {!account ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">Your account details could not be loaded.</p>
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
                  <div className="space-y-8">
                    <section className="flex items-center gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium" aria-hidden="true">
                        {(account.displayName || account.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{account.displayName || 'Your account'}</h3>
                        <p className="truncate text-sm text-muted-foreground">{account.email}</p>
                      </div>
                    </section>

                    <dl className="grid gap-4 border-y border-border py-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm text-muted-foreground">Email address</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                          {account.email}
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            {account.emailVerified ? 'Verified' : 'Not verified'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Projects</dt>
                        <dd className="mt-1 text-sm font-medium">{account.projectCount.toLocaleString()}</dd>
                      </div>
                    </dl>

                    {!account.emailVerified && (
                      <section className="space-y-3">
                        <h3 className="font-medium">Verify your email</h3>
                        <p className="text-sm text-muted-foreground">
                          Verify your email address to keep your account information up to date.
                        </p>
                        <div className="flex flex-wrap gap-2">
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

                    <section className="space-y-3 border-t border-border pt-6">
                      <div>
                        <h3 className="font-medium">Privacy and data</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
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
                  <div className="space-y-5">
                    {usage ? (
                      usage.meters.length > 0 ? (
                        usage.meters.map((meter) => <UsageMeter key={meter.meterKey} meter={meter} />)
                      ) : (
                        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                          No usage data is available yet.
                        </p>
                      )
                    ) : (
                      <p role="alert" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
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
                  <div className="space-y-6">
                    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                      <p className="text-sm text-muted-foreground">Current plan</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{account.plan.name}</h3>
                      {account.subscriptionStatus && (
                        <p className="mt-2 text-sm text-muted-foreground">{account.subscriptionStatus}</p>
                      )}
                    </section>

                    <section className="space-y-3">
                      <h3 className="font-medium">Manage your subscription</h3>
                      <p className="text-sm text-muted-foreground">
                        Open your billing portal to manage billing details and your subscription.
                      </p>
                      <div className="flex flex-wrap gap-2">
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
