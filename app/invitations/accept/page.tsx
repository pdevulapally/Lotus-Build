'use client'

/**
 * Landing for the link in an organisation invitation email. The server accepts the
 * invitation only for the signed-in account whose verified email was invited, so this
 * page just requires sign-in, hands the token over once, and reports what the server said.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { BackendError } from '@/lib/backend/client'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useSettingsDialog } from '@/components/settings/settings-dialog'
import { LogoLoader } from '@/components/ui/logo-loader'
import { Button } from '@/components/ui/button'

type Outcome = { kind: 'pending' } | { kind: 'joined'; name: string } | { kind: 'failed'; message: string }

const failureCopy: Readonly<Record<string, string>> = {
  'organisation/invitation-invalid': 'This invitation link is not valid. Ask the person who invited you to send a new one.',
  'organisation/invitation-expired': 'This invitation has expired. Ask the person who invited you to send a new one.',
  'organisation/invitation-email-mismatch': 'This invitation was sent to a different email address. Sign in with the address that received it.',
  'organisation/seats-full': 'The organisation has no free seats. Its owner needs to add a seat before you can join.',
  'account/email-unverified': 'Verify your email address first, then open this link again.',
}

function AcceptInvitation() {
  const params = useSearchParams()
  const router = useRouter()
  const { account, refreshAccount, switchWorkspace } = useAuth()
  const { openSettings } = useSettingsDialog()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' })
  const attempted = useRef(false)
  const orgId = params.get('organisation')
  const token = params.get('token')

  useEffect(() => {
    if (attempted.current || !account) return
    attempted.current = true
    if (!orgId || !token) { setOutcome({ kind: 'failed', message: failureCopy['organisation/invitation-invalid']! }); return }
    void (async () => {
      try {
        const organisation = await currentBackend().acceptInvitation(orgId, token)
        await refreshAccount()
        setOutcome({ kind: 'joined', name: organisation.name })
        await switchWorkspace(organisation.id).catch(() => undefined)
      } catch (reason) {
        const code = reason instanceof BackendError ? reason.code : ''
        setOutcome({ kind: 'failed', message: failureCopy[code] ?? (reason instanceof Error ? reason.message : 'The invitation could not be accepted.') })
      }
    })()
  }, [account, orgId, token, refreshAccount, switchWorkspace])

  if (outcome.kind === 'pending') return <LogoLoader label="Checking your invitation…" />
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center" aria-live="polite">
        <h1 className="text-xl font-semibold tracking-tight">{outcome.kind === 'joined' ? `You’re in ${outcome.name}` : 'This invitation can’t be used'}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {outcome.kind === 'joined' ? 'The organisation is now one of your workspaces. Switch to it from Settings whenever you like.' : outcome.message}
        </p>
        <div className="flex justify-center gap-3">
          {outcome.kind === 'joined' && <Button type="button" onClick={() => { openSettings('org-members'); router.replace('/') }}>Open the organisation</Button>}
          <Button asChild variant={outcome.kind === 'joined' ? 'outline' : 'default'}><Link href="/">Go to my workspace</Link></Button>
        </div>
      </section>
    </main>
  )
}

export default function AcceptInvitationPage() {
  return (
    <ProtectedRoute requiredTokens={0}>
      <Suspense fallback={<LogoLoader label="Checking your invitation…" />}>
        <AcceptInvitation />
      </Suspense>
    </ProtectedRoute>
  )
}
