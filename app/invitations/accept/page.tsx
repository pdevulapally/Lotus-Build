'use client'

/**
 * Landing for the link in an organisation invitation email. The server accepts the
 * invitation only for the signed-in account whose verified email was invited, so this
 * page just requires sign-in, hands the token over once, and reports what the server said.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { BackendError } from '@/lib/backend/client'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useSettingsDialog } from '@/components/settings/settings-dialog'
import { acceptanceKey, attachAcceptance } from '@/lib/organisations/accept-invitation'
import { LogoLoader } from '@/components/ui/logo-loader'
import { Button } from '@/components/ui/button'

type Outcome = { kind: 'pending' } | { kind: 'joined'; id: string; name: string } | { kind: 'failed'; message: string }

const failureCopy: Readonly<Record<string, string>> = {
  'organisation/invitation-invalid': 'This invitation link is not valid, or it was sent to a different email address. Sign in with the address that received it, or ask for a new invitation.',
  'organisation/invitation-not-found': 'This invitation has expired or been withdrawn. Ask the person who invited you to send a new one.',
  'organisation/not-found': 'This invitation has expired or been withdrawn. Ask the person who invited you to send a new one.',
  'organisation/already-member': 'You are already a member of this organisation.',
  'organisation/seats-full': 'The organisation has no free seats. Its owner needs to add a seat before you can join.',
  'organisation/limit-reached': 'The organisation has no free seats. Its owner needs to add a seat before you can join.',
  'auth/email-not-verified': 'Verify your email address first, then open this link again.',
}

function AcceptInvitation() {
  const params = useSearchParams()
  const router = useRouter()
  const { account, authEpoch, principal: livePrincipal, refreshAccount, switchWorkspace } = useAuth()
  const { openSettings } = useSettingsDialog()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' })
  const principal = account ? `${account.uid}#${authEpoch}` : ''
  const orgId = params.get('organisation')
  const token = params.get('token')

  useEffect(() => {
    if (principal === '') return
    if (!orgId || !token) { setOutcome({ kind: 'failed', message: failureCopy['organisation/invitation-invalid']! }); return }
    // The operation is keyed by principal + invitation and lives outside this effect: a StrictMode replay or a
    // remount re-attaches to it (one submission); a different invitation, or the same account signed in again,
    // starts its own. Cleanup detaches only this component's reporting. The operation's own continuations
    // (refresh, selection) are fenced by the provider's live principal, which outlives the page.
    return attachAcceptance(acceptanceKey(principal, orgId, token), {
      principal: livePrincipal,
      accept: () => currentBackend().acceptInvitation(orgId, token),
      refresh: refreshAccount,
      select: switchWorkspace,
    }, (result) => {
      if (result.kind === 'joined') { setOutcome(result); return }
      const code = result.reason instanceof BackendError ? result.reason.code : ''
      setOutcome({ kind: 'failed', message: failureCopy[code] ?? (result.reason instanceof Error ? result.reason.message : 'The invitation could not be accepted.') })
    })
  }, [principal, livePrincipal, orgId, token, refreshAccount, switchWorkspace])

  if (outcome.kind === 'pending') return <LogoLoader label="Checking your invitation…" />
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center" aria-live="polite">
        <h1 className="text-xl font-semibold tracking-tight">{outcome.kind === 'joined' ? `You’re in ${outcome.name}` : 'This invitation can’t be used'}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {outcome.kind === 'joined' ? 'The organisation is now one of your workspaces. Switch to it from Settings whenever you like.' : outcome.message}
        </p>
        <div className="flex justify-center gap-3">
          {outcome.kind === 'joined' && (
            <Button type="button" onClick={() => { void switchWorkspace(outcome.id).catch(() => undefined).then(() => { openSettings('org-members'); router.replace('/') }) }}>
              Open the organisation
            </Button>
          )}
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
