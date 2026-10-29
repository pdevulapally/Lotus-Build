'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Stack } from '@astryxdesign/core'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendUsage } from '@/lib/backend/client'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { Button } from '@/components/ui/button'
import {
  BillingIcon,
  UsageIcon,
  RefreshIcon,
  SettingsIcon,
  ShieldIcon,
  LockIcon,
  ResearchIcon,
  ArrowRightIcon,
  ExternalIcon,
} from '@/components/ui/lotus-icons'
import {
  getStoredConsent,
  useCookiePreferences,
} from '@/components/cookie-banner'
import {
  SETTINGS_SECTIONS,
  filterSettings,
  settingsPage,
  canShowSettingsFeedback,
  type SettingsPage,
} from './settings-sections'
import styles from './settings-dialog.module.css'

const SECTION_ICONS = {
  account: SettingsIcon,
  security: LockIcon,
  privacy: ShieldIcon,
  usage: UsageIcon,
  billing: BillingIcon,
}
const RESET_LABELS = {
  NEVER: 'Does not reset',
  DAILY: 'Resets daily',
  MONTHLY: 'Resets monthly',
} as const

type SettingsContext = {
  openSettings: (section?: SettingsPage) => void
  closeSettings: () => void
}
const Context = createContext<SettingsContext | null>(null)
export function useSettingsDialog() {
  const value = useContext(Context)
  if (!value) throw new Error('SettingsDialogProvider is missing.')
  return value
}

// Keep existing navigation callers stable while giving settings a durable URL.
export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const openSettings = useCallback(
    (section: SettingsPage = 'account') => router.push(`/settings#${section}`),
    [router],
  )
  const closeSettings = useCallback(() => router.push('/'), [router])
  const value = useMemo(
    () => ({ openSettings, closeSettings }),
    [openSettings, closeSettings],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}
type UsageMeterProps = { meter: BackendUsage['meters'][number] }

function UsageMeter({ meter }: UsageMeterProps) {
  const hasLimit = meter.hardLimit > 0
  const isAtLimit = hasLimit && meter.totalUsed >= meter.hardLimit
  const progress = hasLimit
    ? Math.min((meter.totalUsed / meter.hardLimit) * 100, 100)
    : null

  return (
    <section
      className="py-6 first:pt-0"
      aria-labelledby={`usage-${meter.meterKey}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`usage-${meter.meterKey}`} className="text-sm font-semibold">
            {meter.label}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Period started {new Date(meter.periodStart).toLocaleDateString()} ·{' '}
            {RESET_LABELS[meter.resetPeriod]}
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
          <span className="text-3xl font-semibold tabular-nums tracking-tight">
            {meter.totalUsed.toLocaleString()}
          </span>
          {hasLimit ? (
            <span className="ml-2 text-sm text-muted-foreground">
              of {meter.hardLimit.toLocaleString()} {meter.unit}
            </span>
          ) : (
            <span className="ml-2 text-sm text-muted-foreground">
              {meter.unit} used
            </span>
          )}
        </p>
        {progress !== null && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {Math.round(progress)}% used
          </p>
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
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
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

function PreferenceSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <Stack
      direction="horizontal"
      hAlign="between"
      vAlign="center"
      gap={5}
      className={styles.preference}
    >
      <Stack gap={1}>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <p
          id={`${id}-description`}
          className="text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      </Stack>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-description`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={styles.switch}
      >
        <span />
      </button>
    </Stack>
  )
}

export function SettingsPageContent() {
  const {
    user,
    account,
    usage,
    accountError,
    refreshAccount,
    sendPasswordResetEmail,
  } = useAuth()
  const { consent, update: updateConsent } = useCookiePreferences()
  const [page, setPage] = useState<SettingsPage>('account')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [erasureConfirmed, setErasureConfirmed] = useState(false)
  const operation = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const identity = useRef(user?.uid)
  const currentSection = useRef(page)
  currentSection.current = page
  identity.current = user?.uid
  const active = SETTINGS_SECTIONS.find((section) => section.id === page)!
  const matches = filterSettings(query)
  const hasPassword =
    user?.providerData.some((provider) => provider.providerId === 'password') ??
    false

  useEffect(() => {
    const read = () => {
      const next = settingsPage(window.location.hash.slice(1))
      currentSection.current = next
      setPage(next)
      setQuery('')
      setMessage(null)
      setError(null)
      setErasureConfirmed(false)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  useEffect(() => {
    setMessage(null)
    setError(null)
    setErasureConfirmed(false)
  }, [user?.uid])

  const choose = (next: SettingsPage) => {
    currentSection.current = next
    setPage(next)
    setQuery('')
    setMessage(null)
    setError(null)
    setErasureConfirmed(false)
    if (window.location.hash !== `#${next}`) window.location.hash = next
    requestAnimationFrame(() => heading.current?.focus())
  }
  const perform = async (work: () => Promise<string | void>) => {
    if (operation.current) return
    const origin = { uid: user?.uid, section: currentSection.current }
    const feedbackIsCurrent = () =>
      canShowSettingsFeedback(origin, {
        uid: identity.current,
        section: currentSection.current,
      })
    operation.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await work()
      if (feedbackIsCurrent() && result) setMessage(result)
    } catch (reason) {
      if (feedbackIsCurrent())
        setError(
          reason instanceof Error
            ? reason.message
            : 'The operation failed. Please try again.',
        )
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  const changeConsent = (analytics: boolean, functional: boolean) => {
    updateConsent(analytics, functional)
    const saved = getStoredConsent()
    if (saved?.analytics === analytics && saved.functional === functional) {
      setError(null)
      setMessage('Cookie preferences saved for this browser.')
    } else {
      setMessage(null)
      setError(
        'Your browser could not save these preferences. They may reset when you reload.',
      )
    }
  }
  const unavailable = (
    <Stack gap={3} className={styles.empty}>
      <SettingsIcon className="size-6 text-muted-foreground" />
      <h3 className="text-lg font-semibold">Account details are unavailable</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Try again to load your account. You can still use security and privacy
        settings.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void perform(refreshAccount)}
        className="self-start"
      >
        <RefreshIcon />
        Try again
      </Button>
    </Stack>
  )

  return (
    <main data-product-theme="dark" className={`dark ${styles.page}`}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <img
            src="/Images/lotusbuild-icon.svg"
            alt=""
            width={29}
            height={26}
          />
          LotusBuild
        </Link>
        <Link href="/" className={styles.back}>
          Back to workspace <ArrowRightIcon />
        </Link>
      </header>
      <section className={styles.heading}>
        <p>Your workspace</p>
        <h1>Settings</h1>
        <span>
          Account access, privacy, usage and billing.
        </span>
      </section>
      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <label className={styles.search}>
            <ResearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a setting"
              aria-label="Find a setting"
            />
          </label>
          <nav aria-label="Settings sections" className={styles.nav}>
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.id]
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={
                    page === section.id && !query ? 'page' : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault()
                    choose(section.id)
                  }}
                >
                  <Icon />
                  <span>{section.label}</span>
                  <ArrowRightIcon className={styles.navArrow} />
                </a>
              )
            })}
          </nav>
          <p className={styles.help}>
            Need a hand?
            <br />
            <Link href="/help">
              Visit the help centre <ExternalIcon />
            </Link>
          </p>
        </aside>
        <section
          className={styles.panel}
          aria-busy={busy}
          aria-labelledby="settings-heading"
        >
          <header className={styles.panelHeader}>
            <h2 ref={heading} id="settings-heading" tabIndex={-1}>
              {query ? 'Find a setting' : active.label}
            </h2>
            <p>
              {query
                ? 'Jump directly to the option you need.'
                : active.description}
            </p>
          </header>
          {query ? (
            <Stack gap={3}>
              <p role="status" className="text-xs text-muted-foreground">
                {matches.length} {matches.length === 1 ? 'section' : 'sections'}{' '}
                found
              </p>
              {matches.map((section) => {
                const Icon = SECTION_ICONS[section.id]
                return (
                  <button
                    key={section.id}
                    className={styles.searchResult}
                    onClick={() => choose(section.id)}
                  >
                    <Icon />
                    <span>
                      <strong>{section.label}</strong>
                      <small>{section.description}</small>
                    </span>
                    <ArrowRightIcon />
                  </button>
                )
              })}
              {!matches.length && (
                <p className="py-8 text-sm text-muted-foreground">
                  No matching settings. Try “password”, “cookies” or “billing”.
                </p>
              )}
            </Stack>
          ) : (
            <>
              {(error || accountError) && (
                <p role="alert" className={styles.error}>
                  {error || accountError}
                </p>
              )}
              {message && (
                <p role="status" className={styles.notice}>
                  {message}
                </p>
              )}
              {page === 'account' &&
                (account ? (
                  <Stack gap={6} className={styles.contentStack}>
                    <Stack
                      direction="horizontal"
                      gap={4}
                      vAlign="center"
                      className={styles.profile}
                    >
                      <span className={styles.avatar} aria-hidden="true">
                        {(account.displayName || account.email)
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <Stack gap={1} className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">
                          {account.displayName || 'Your account'}
                        </h3>
                        <p className="break-all text-sm text-muted-foreground">
                          Signed in to LotusBuild
                        </p>
                      </Stack>
                    </Stack>
                    <dl className={styles.details}>
                      <div>
                        <dt>
                          Email address<small>Your sign-in address</small>
                        </dt>
                        <dd>
                          {account.email}
                          <span className={styles.badge}>
                            {account.emailVerified
                              ? 'Verified'
                              : 'Not verified'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          Projects<small>Everything you’re working on</small>
                        </dt>
                        <dd>{account.projectCount.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>
                          Current plan<small>Your workspace subscription</small>
                        </dt>
                        <dd>
                          {account.plan.name}
                          <button
                            onClick={() => choose('billing')}
                            className={styles.inlineLink}
                          >
                            Manage plan <ArrowRightIcon />
                          </button>
                        </dd>
                      </div>
                    </dl>
                    {!account.emailVerified && (
                      <section>
                        <h3 className="mb-3 text-sm font-semibold">
                          Verify your email
                        </h3>
                        <EmailCodeVerification
                          email={user?.email ?? account.email}
                          autoSend={false}
                          onVerified={() => setMessage('Email verified.')}
                        />
                      </section>
                    )}
                    <section
                      className={styles.accountShortcuts}
                      aria-label="More account settings"
                    >
                      <button type="button" onClick={() => choose('security')}>
                        <LockIcon />
                        <span>
                          <strong>Sign-in &amp; security</strong>
                          <small>Manage account access</small>
                        </span>
                        <ArrowRightIcon />
                      </button>
                      <button type="button" onClick={() => choose('privacy')}>
                        <ShieldIcon />
                        <span>
                          <strong>Privacy &amp; data</strong>
                          <small>Choose what you share</small>
                        </span>
                        <ArrowRightIcon />
                      </button>
                    </section>
                    <p className={styles.profileNote}>
                      Your profile comes from your sign-in account. Profile
                      editing is not available here yet.
                    </p>
                  </Stack>
                ) : (
                  unavailable
                ))}
              {page === 'security' && (
                <Stack gap={6} className={styles.contentStack}>
                  <section>
                    <h3 className="text-sm font-semibold">How you sign in</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Methods connected to your current account.
                    </p>
                    <ul className={styles.providers}>
                      {user?.providerData.map((provider) => (
                        <li key={provider.providerId}>
                          <LockIcon />
                          <span>
                            {(
                              {
                                password: 'Email and password',
                                'google.com': 'Google',
                                'github.com': 'GitHub',
                              } as Record<string, string>
                            )[provider.providerId] ?? provider.providerId}
                          </span>
                          <span className={styles.badge}>Connected</span>
                        </li>
                      ))}
                    </ul>
                    {!user?.providerData.length && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Sign-in method details are unavailable.
                      </p>
                    )}
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold">Password</h3>
                    <p className="my-3 text-sm leading-relaxed text-muted-foreground">
                      {hasPassword
                        ? `We’ll send a password reset link to ${user?.email ?? 'your email address'}.`
                        : 'Your password is managed by your sign-in provider. Change it in that provider’s account settings.'}
                    </p>
                    {hasPassword && (
                      <Button
                        variant="outline"
                        disabled={busy || !user?.email}
                        onClick={() =>
                          void perform(async () => {
                            if (!user?.email)
                              throw new Error('No email address is available.')
                            await sendPasswordResetEmail(user.email)
                            return 'Password reset email sent. Check your inbox.'
                          })
                        }
                      >
                        Send password reset email
                      </Button>
                    )}
                  </section>
                  <p className={styles.footnote}>
                    Password changes happen through your verified sign-in
                    provider. LotusBuild never asks for your password here.
                  </p>
                </Stack>
              )}
              {page === 'privacy' && (
                <Stack gap={6} className={styles.contentStack}>
                  <section>
                    <h3 className="text-sm font-semibold">
                      Cookie preferences
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      These choices apply to this browser. Essential cookies
                      stay on to keep sign-in and security working.
                    </p>
                    <PreferenceSwitch
                      label="Analytics"
                      description="Allow usage analytics to help improve LotusBuild."
                      checked={consent?.analytics ?? false}
                      onChange={(checked) =>
                        changeConsent(checked, consent?.functional ?? false)
                      }
                    />
                    <PreferenceSwitch
                      label="Functional cookies"
                      description="Allow optional preferences to be remembered."
                      checked={consent?.functional ?? false}
                      onChange={(checked) =>
                        changeConsent(consent?.analytics ?? false, checked)
                      }
                    />
                    <Link href="/privacy#cookies" className={styles.inlineLink}>
                      Read our cookie policy <ExternalIcon />
                    </Link>
                  </section>
                  <section className={styles.erasure}>
                    <h3 className="text-sm font-semibold">
                      Request account erasure
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Erasure requests are reviewed before deletion. Sending a
                      request does not immediately delete your account.
                    </p>
                    {account ? (
                      <>
                        <label className={styles.confirm}>
                          <input
                            type="checkbox"
                            checked={erasureConfirmed}
                            onChange={(event) =>
                              setErasureConfirmed(event.target.checked)
                            }
                            disabled={busy}
                          />
                          <span>
                            I want to request deletion of my account data.
                          </span>
                        </label>
                        <Button
                          variant="outline"
                          disabled={busy || !erasureConfirmed}
                          onClick={() =>
                            void perform(async () => {
                              const result =
                                await currentBackend().requestErasure()
                              setErasureConfirmed(false)
                              return `${result.message} Reference: ${result.request.reference}`
                            })
                          }
                        >
                          Send erasure request
                        </Button>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Load your account details before requesting erasure.
                      </p>
                    )}
                  </section>
                </Stack>
              )}
              {page === 'usage' && (
                <Stack gap={5}>
                  {usage ? (
                    usage.meters.length ? (
                      <Stack className="divide-y divide-border/70">
                        {usage.meters.map((meter) => (
                          <UsageMeter key={meter.meterKey} meter={meter} />
                        ))}
                      </Stack>
                    ) : (
                      <p className="py-6 text-sm text-muted-foreground">
                        No usage has been recorded yet.
                      </p>
                    )
                  ) : (
                    <p className="py-6 text-sm text-muted-foreground">
                      Usage data is unavailable. Refresh to try again.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={busy}
                    onClick={() => void perform(refreshAccount)}
                  >
                    <RefreshIcon />
                    {busy ? 'Please wait…' : 'Refresh usage'}
                  </Button>
                </Stack>
              )}
              {page === 'billing' &&
                (account ? (
                  <Stack gap={6} className={styles.contentStack}>
                    <section className={styles.plan}>
                      <span>Current plan</span>
                      <h3>{account.plan.name}</h3>
                      {account.subscriptionStatus && (
                        <p>{account.subscriptionStatus}</p>
                      )}
                    </section>
                    <section>
                      <h3 className="text-sm font-semibold">
                        Billing details and subscription
                      </h3>
                      <p className="my-3 text-sm leading-relaxed text-muted-foreground">
                        Your secure billing portal has payment details, invoices
                        and subscription options.
                      </p>
                      <Stack direction="horizontal" wrap="wrap" gap={3}>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void perform(async () => {
                              const uid = user?.uid
                              const result =
                                await currentBackend().billingPortal()
                              if (identity.current === uid)
                                window.location.assign(result.url)
                            })
                          }
                        >
                          <BillingIcon />
                          Open billing portal <ExternalIcon />
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/pricing">Compare plans</Link>
                        </Button>
                      </Stack>
                    </section>
                  </Stack>
                ) : (
                  unavailable
                ))}
            </>
          )}
        </section>
      </section>
    </main>
  )
}
