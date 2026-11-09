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
import { acceptanceKey, attachAcceptance, retryJoin, type AcceptOutcome } from '@/lib/organisations/accept-invitation'
import { LogoLoader } from '@/components/ui/logo-loader'
import { Button } from '@/components/ui/button'

type Outcome = { kind: 'pending' } | Extract<AcceptOutcome, { kind: 'joined' }> | { kind: 'failed'; message: string }

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
  const { user, authEpoch, principal: livePrincipal, refreshAccount, switchWorkspace, currentWorkspace } = useAuth()
  const { openSettings } = useSettingsDialog()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending' })
  // The principal is the signed-in user and session, not the loaded account: a failed account refresh clears the
  // account but not the sign-in, and must not detach this page from an acceptance it is waiting on.
  const principal = user ? `${user.uid}#${authEpoch}` : ''
  const orgId = params.get('organisation')
  const token = params.get('token')
  const key = principal !== '' && orgId && token ? acceptanceKey(principal, orgId, token) : null

  useEffect(() => {
    if (principal === '') return
    if (!orgId || !token) { setOutcome({ kind: 'failed', message: failureCopy['organisation/invitation-invalid']! }); return }
    // The operation is keyed by principal + invitation and lives outside this effect: a StrictMode replay or a
    // remount re-attaches to it (one submission); a different invitation, or the same account signed in again,
    // starts its own. Cleanup detaches only this component's reporting. The operation's own continuations
    // (refresh, selection) are fenced by the provider's live principal, which outlives the page.
    return attachAcceptance(key!, {
      principal: livePrincipal,
      accept: () => currentBackend().acceptInvitation(orgId, token),
      refresh: refreshAccount,
      select: switchWorkspace,
    }, (result) => {
      if (result.kind === 'joined') { setOutcome(result); return }
      const code = result.reason instanceof BackendError ? result.reason.code : ''
      setOutcome({ kind: 'failed', message: failureCopy[code] ?? (result.reason instanceof Error ? result.reason.message : 'The invitation could not be accepted.') })
    })
  }, [principal, livePrincipal, orgId, token, key, refreshAccount, switchWorkspace])

  if (outcome.kind === 'pending') return <LogoLoader label="Checking your invitation…" />
  // Accepted and ready are different facts: the server has used the invitation; the organisation is the
  // selected workspace only once the account refresh and the switch have both happened for this account.
  const readiness = outcome.kind === 'joined' ? outcome.workspace : null
  const failed = readiness !== null && typeof readiness === 'object' ? readiness.failed : null
  // Ready means confirmed for this page and still true now: the organisation is the account's selected workspace.
  const ready = outcome.kind === 'joined' && readiness === 'ready' && currentWorkspace?.id === outcome.id
  const description = outcome.kind !== 'joined' ? outcome.message
    : ready ? 'The organisation is now your selected workspace. Switch back from Settings whenever you like.'
    : failed !== null ? `You have joined, but the organisation could not be opened as your workspace: ${failed}`
    : 'Setting up the organisation as your workspace…'
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center" aria-live="polite">
        <h1 className="text-xl font-semibold tracking-tight">{outcome.kind === 'joined' ? `You’re in ${outcome.name}` : 'This invitation can’t be used'}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="flex justify-center gap-3">
          {outcome.kind === 'joined' && failed === null && (
            <Button type="button" disabled={!ready} onClick={() => { if (ready) { openSettings('org-members'); router.replace('/') } }}>
              Open the organisation
            </Button>
          )}
          {outcome.kind === 'joined' && failed !== null && key && (
            <Button type="button" onClick={() => retryJoin(key, { principal: livePrincipal, refresh: refreshAccount, select: switchWorkspace })}>Try again</Button>
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
