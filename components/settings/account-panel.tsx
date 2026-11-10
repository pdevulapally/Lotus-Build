import type { BackendAccount } from '@/lib/backend/client'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { CookiePreferencesButton } from '@/components/cookie-banner'
import { Button } from '@/components/ui/button'

export function AccountPanel({ account, email, busy, onVerified, onErasure }: {
  account: BackendAccount
  email: string
  busy: boolean
  onVerified: () => void
  onErasure: () => void
}) {
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold" aria-hidden="true">
          {(account.displayName || account.email).slice(0, 1).toUpperCase()}
        </span>
        <section className="min-w-0">
          <h3 className="truncate text-base font-semibold">{account.displayName || 'Your account'}</h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">{account.email}</p>
        </section>
      </header>
      <section className="divide-y divide-border/60 border-y border-border/60">
        <dl className="flex flex-wrap items-baseline justify-between gap-3 py-4">
          <dt className="text-sm text-muted-foreground">Email verification</dt>
          <dd className="text-sm font-medium">{account.emailVerified ? 'Verified' : 'Not verified'}</dd>
        </dl>
        <dl className="flex items-baseline justify-between gap-3 py-4">
          <dt className="text-sm text-muted-foreground">Projects</dt>
          <dd className="text-sm font-medium tabular-nums">{account.projectCount.toLocaleString()}</dd>
        </dl>
      </section>
      {!account.emailVerified && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Verify your email</h3>
          <EmailCodeVerification email={email} autoSend={false} onVerified={onVerified} />
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold">Privacy</h3>
        <p className="mt-2 text-sm text-muted-foreground">Choose how optional cookies are used.</p>
        <CookiePreferencesButton className="mt-3 block min-h-11 rounded-lg text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" />
      </section>
      <section className="border-t border-border/60 pt-6">
        <h3 className="text-sm font-semibold">Account erasure</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Requests are reviewed before deletion. Submitting a request does not delete your account.
        </p>
        <Button type="button" variant="outline" className="mt-4" disabled={busy} onClick={onErasure}>
          Request account erasure
        </Button>
      </section>
    </section>
  )
}
