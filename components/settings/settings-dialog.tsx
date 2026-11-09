'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendInvitation, BackendMember, BackendOrganisation, BackendOrganisationBilling, BackendPlan, BackendSubscription, BackendWorkspace } from '@/lib/backend/client'
import { can, finishPendingSeatChange, visibleRecovery, type SeatRecoveryOutcome, type StoredSeatRecovery } from '@/lib/settings/organisations'
import { CreateOrganisationDialog } from './organisation/create-organisation-dialog'
import { InviteMemberDialog } from './organisation/invite-member-dialog'
import { TypedConfirmationDialog } from './typed-confirmation-dialog'
import { createOrganisationIntent, intentStore, organisationName, seatsIntent, subscriptionIntent, type IntentStore } from '@/lib/backend/intent-key'
import { pendingCommandStorage } from '@/lib/backend/pending-storage'
import { describeSubscriptionOutcome, longDate } from '@/lib/settings/plans'
import { principalFence } from '@/lib/settings/principal-fence'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SettingsPanel, isOrganisationPage, navFor, type OrganisationSettings, type SettingsPage } from './settings-panel'
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

type OrganisationHandlers = {
  organisation: BackendOrganisation | null; members: readonly BackendMember[] | null; invitations: readonly BackendInvitation[] | null
  billing: BackendOrganisationBilling | null; currentUid: string
  onRename: (name: string) => void; onTransfer: (uid: string) => void; onLeave: () => void; onDelete: () => void
  onInvite: () => void; onChangeRole: (uid: string, role: 'admin' | 'member') => void; onRemove: (member: BackendMember) => void; onRevoke: (invitation: BackendInvitation) => void
  onCheckout: (planKey: string, seats: number) => void; onChangeSeats: (seats: number) => void; onManageBilling: () => void; onReconcile: () => void; recovery: SeatRecoveryOutcome | null
}
/** Page props for the selected organisation; null pages until it has loaded. */
function organisationSettings(h: OrganisationHandlers): OrganisationSettings {
  if (h.organisation === null) return { general: null, members: null, plan: null }
  return {
    general: { organisation: h.organisation, members: h.members, currentUid: h.currentUid, onRename: h.onRename, onTransfer: h.onTransfer, onLeave: h.onLeave, onDelete: h.onDelete },
    members: { organisation: h.organisation, members: h.members, invitations: h.invitations, currentUid: h.currentUid, onInvite: h.onInvite, onChangeRole: h.onChangeRole, onRemove: h.onRemove, onRevoke: h.onRevoke },
    plan: { organisation: h.organisation, billing: h.billing, onCheckout: h.onCheckout, onChangeSeats: h.onChangeSeats, onManageBilling: h.onManageBilling, onReconcile: h.onReconcile, recovery: h.recovery },
  }
}

/**
 * Settings as a modal over whatever the user is doing. The surface follows the
 * surrounding theme; the panel inside knows nothing of auth or the backend,
 * which stay here with the busy/message/error state they produce.
 */
export function SettingsDialog({ open, onOpenChange, initialPage = 'account' }: { open: boolean; onOpenChange: (value: boolean) => void; initialPage?: SettingsPage }) {
  const { user, account, usage, accountError, refreshAccount, authEpoch, workspaces, currentWorkspace, switchWorkspace } = useAuth()
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
  // A page must exist for the selected workspace; a switch lands on that workspace's first section.
  useEffect(() => {
    const organisationSelected = currentWorkspace?.kind === 'organisation'
    if (organisationSelected !== isOrganisationPage(page)) setPage(navFor(currentWorkspace)[0]!.pages[0]!)
  }, [currentWorkspace, page])

  // Organisation state is server state, read for the selected organisation and after every change to it.
  const orgId = currentWorkspace?.kind === 'organisation' ? currentWorkspace.id : null
  const [organisation, setOrganisation] = useState<BackendOrganisation | null>(null)
  const [members, setMembers] = useState<readonly BackendMember[] | null>(null)
  const [invitations, setInvitations] = useState<readonly BackendInvitation[] | null>(null)
  const [orgBilling, setOrgBilling] = useState<BackendOrganisationBilling | null>(null)
  const [recovery, setRecovery] = useState<StoredSeatRecovery | null>(null)
  const [orgRevision, setOrgRevision] = useState(0)
  const [creatingOrganisation, setCreatingOrganisation] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deletingOrganisation, setDeletingOrganisation] = useState(false)
  const [removing, setRemoving] = useState<BackendMember | null>(null)
  useEffect(() => {
    setOrganisation(null); setMembers(null); setInvitations(null)
    if (!open || orgId === null) return
    const controller = new AbortController()
    void (async () => {
      try {
        const backend = currentBackend()
        const current = await backend.organisation(orgId, controller.signal)
        if (controller.signal.aborted) return
        setOrganisation(current)
        const [people, pending, billing] = await Promise.all([
          backend.organisationMembers(orgId, controller.signal),
          can(current.role, 'invite') ? backend.organisationInvitations(orgId, controller.signal) : Promise.resolve({ invitations: [] as readonly BackendInvitation[] }),
          can(current.role, 'viewBilling') ? backend.organisationBilling(orgId, controller.signal) : Promise.resolve(null),
        ])
        if (controller.signal.aborted) return
        setMembers(people.members); setInvitations(pending.invitations); setOrgBilling(billing)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The organisation could not be loaded.')
      }
    })()
    return () => controller.abort()
  }, [open, orgId, orgRevision])
  // What "Finish pending change" found belongs to this owner and organisation: a reload of the organisation
  // keeps it (the link must survive its own reload), a different organisation or principal clears it.
  useEffect(() => { setRecovery(null) }, [orgId])
  const reloadOrganisation = async () => { await refreshAccount(); setOrgRevision((value) => value + 1) }

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
  const uid = account?.uid ?? ''
  const intents = useMemo(() => uid === '' ? null : intentStore({ uid, storage: pendingCommandStorage() }), [uid])
  const intend = <T,>(intent: Parameters<IntentStore['run']>[0], work: (key: string) => Promise<T>): Promise<T> => {
    if (intents === null) throw new Error('Sign in again to change your plan.')
    return intents.run(intent, work)
  }
  const reloadBilling = async () => { await refreshAccount(); setBillingRevision((value) => value + 1) }

  // The signed-in session, not just the account: signing out and back in as the same account is a new principal.
  const principal = uid === '' ? '' : `${uid}#${authEpoch}`
  const principalRef = useRef(principal); principalRef.current = principal
  const fenced = useMemo(() => principalFence(() => principalRef.current), [])
  // A different account signed in: nothing the previous one was looking at or waiting for carries over.
  // A new principal starts from a clean dialog: nothing the previous one saw, cached or was waiting for carries over.
  useEffect(() => { setPlans(null); setSubscription(undefined); setOrganisation(null); setMembers(null); setInvitations(null); setOrgBilling(null); setRecovery(null); setPlanChange(null); setClosingAccount(false); setCreatingOrganisation(false); setInviting(false); setDeletingOrganisation(false); setRemoving(null); setMessage(null); setError(null); setBusy(false) }, [principal])
  const perform = async (work: (live: () => boolean) => Promise<void>) => {
    if (busy) return
    await fenced(work, { busy: setBusy, error: setError, message: setMessage })
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
          onRefresh={() => void perform(async () => { await refreshAccount() })}
          plan={{
            plans,
            subscription,
            onManageBilling: () => void perform(async (live) => {
              const result = await currentBackend().billingPortal()
              if (live()) window.location.assign(result.url)
            }),
            onSubscribe: (plan) => void perform(async (live) => {
              const result = await currentBackend().checkout(plan.key)
              if (live()) window.location.assign(result.url)
            }),
            onChangePlan: (plan, relation) => { setError(null); setMessage(null); setPlanChange({ plan, relation }) },
            onSetCancellation: (cancelAtPeriodEnd) => void perform(async (live) => {
              const result = await intend(subscriptionIntent(`cancellation:${cancelAtPeriodEnd}`), (key) => currentBackend().setCancellation(cancelAtPeriodEnd, key))
              if (!live()) return
              await reloadBilling()
              if (live()) setMessage(describeSubscriptionOutcome(result.subscription, plans))
            }),
          }}
          workspaces={workspaces}
          workspace={currentWorkspace}
          onSelectWorkspace={(workspace: BackendWorkspace) => void perform(() => switchWorkspace(workspace.id))}
          onCreateOrganisation={() => { setError(null); setMessage(null); setCreatingOrganisation(true) }}
          organisation={organisationSettings({
            organisation, members, invitations, billing: orgBilling, currentUid: account?.uid ?? '',
            onRename: (name) => void perform(async (live) => { if (orgId) { await currentBackend().renameOrganisation(orgId, name); if (!live()) return; await reloadOrganisation(); if (!live()) return; setMessage('Organisation renamed.') } }),
            onTransfer: (uid) => void perform(async (live) => { if (orgId) { await currentBackend().transferOwnership(orgId, uid); if (!live()) return; await reloadOrganisation(); if (!live()) return; setMessage('Ownership transferred. You are now an admin.') } }),
            onLeave: () => void perform(async (live) => { if (orgId) { await currentBackend().leaveOrganisation(orgId); if (!live()) return; const personal = workspaces.find((w) => w.kind === 'personal'); if (personal) await switchWorkspace(personal.id); if (!live()) return; await refreshAccount(); if (!live()) return; setMessage('You left the organisation.') } }),
            onDelete: () => { setError(null); setMessage(null); setDeletingOrganisation(true) },
            onInvite: () => { setError(null); setMessage(null); setInviting(true) },
            onChangeRole: (uid, role) => void perform(async (live) => { if (orgId) { await currentBackend().changeMemberRole(orgId, uid, role); if (!live()) return; await reloadOrganisation() } }),
            onRemove: (member) => { setError(null); setMessage(null); setRemoving(member) },
            onRevoke: (invitation) => void perform(async (live) => { if (orgId) { await currentBackend().revokeInvitation(orgId, invitation.id); if (!live()) return; await reloadOrganisation(); if (!live()) return; setMessage('Invitation revoked.') } }),
            onCheckout: (planKey, seats) => void perform(async (live) => { if (orgId) { const result = await currentBackend().organisationCheckout(orgId, planKey, seats); if (!live()) return; window.location.assign(result.url) } }),
            onReconcile: () => void perform((live) => orgId ? finishPendingSeatChange({ reconcile: () => currentBackend().reconcileSeats(orgId), reloadOrganisation, live, present: (outcome) => { setRecovery({ principal: principalRef.current, organisationId: orgId, outcome }); if (outcome.kind === 'resolved') setMessage(outcome.message); else setError(outcome.message) } }) : Promise.resolve()),
            recovery: visibleRecovery(recovery, principalRef.current, orgId),
            onChangeSeats: (seats) => void perform(async (live) => { if (orgId) { const result = await intend(seatsIntent(orgId, seats), (key) => currentBackend().changeSeats(orgId, seats, key)); if (!live()) return; await reloadOrganisation(); if (!live()) return; setMessage(`${result.subscription.seats} seats from now on.`) } }),
            onManageBilling: () => void perform(async (live) => { if (orgId) { const result = await currentBackend().organisationPortal(orgId); if (!live()) return; window.location.assign(result.url) } }),
          })}
          onCloseAccount={() => { setError(null); setMessage(null); setClosingAccount(true) }}
          onKeepAccount={() => void perform(async (live) => {
            await currentBackend().keepAccount()
            if (!live()) return
            await refreshAccount()
            if (live()) setMessage('Your account stays open. Nothing was deleted.')
          })}
        />
        <PlanChangeDialog
          request={planChange}
          busy={busy}
          preview={previewPlanChange}
          onClose={() => setPlanChange(null)}
          onConfirm={(plan) => void perform(async (live) => {
            const result = await intend(subscriptionIntent(`plan:${plan.key}`), (key) => currentBackend().changePlan(plan.key, key))
            if (!live()) return
            setPlanChange(null)
            await reloadBilling()
            if (live()) setMessage(describeSubscriptionOutcome(result.subscription, plans))
          })}
        />
        <CreateOrganisationDialog open={creatingOrganisation} busy={busy} onClose={() => setCreatingOrganisation(false)}
          onCreate={(name) => void perform(async (live) => {
            const created = await intend(createOrganisationIntent(name), (key) => currentBackend().createOrganisation(organisationName(name), key))
            if (!live()) return
            setCreatingOrganisation(false)
            const fresh = await refreshAccount()
            if (!live()) return
            await switchWorkspace(created.id, fresh?.workspaces)
            if (!live()) return
            setPage('org-members')
            setMessage(`${created.name} is ready. Invite your team, then choose the Teams plan.`)
          })} />
        {organisation && (
          <InviteMemberDialog open={inviting} busy={busy} organisationName={organisation.name} onClose={() => setInviting(false)}
            onInvite={(email, role) => void perform(async (live) => {
              const invitation = await currentBackend().inviteMember(organisation.id, email, role)
              if (!live()) return
              setInviting(false)
              await reloadOrganisation()
              if (!live()) return
              setMessage(`Invitation sent to ${invitation.email}.`)
            })} />
        )}
        {organisation && (
          <TypedConfirmationDialog open={deletingOrganisation} title={`Delete ${organisation.name}`} phrase={organisation.name} phraseLabel="Organisation name" action="Delete organisation"
            busy={busy} caseSensitive onClose={() => setDeletingOrganisation(false)}
            onConfirm={(typed) => void perform(async (live) => {
              await currentBackend().deleteOrganisation(organisation.id, typed)
              if (!live()) return
              setDeletingOrganisation(false)
              const personal = workspaces.find((w) => w.kind === 'personal')
              if (personal) await switchWorkspace(personal.id)
              await refreshAccount()
              if (!live()) return
              setMessage('Organisation deleted.')
            })}>
            <p>Every member loses access and pending invitations stop working. This cannot be undone.</p>
          </TypedConfirmationDialog>
        )}
        {organisation && removing && (
          <TypedConfirmationDialog open title={`Remove ${removing.displayName ?? removing.email}`} phrase={removing.email} phraseLabel="Their email address" action="Remove member"
            busy={busy} inputMode="email" onClose={() => setRemoving(null)}
            onConfirm={() => void perform(async (live) => {
              await currentBackend().removeMember(organisation.id, removing.uid)
              if (!live()) return
              setRemoving(null)
              await reloadOrganisation()
              if (!live()) return
              setMessage('Member removed.')
            })}>
            <p>They lose access to the organisation’s projects. An admin can invite them again later.</p>
          </TypedConfirmationDialog>
        )}
        {account && (
          <CloseAccountDialog
            open={closingAccount}
            email={account.email}
            busy={busy}
            graceDays={30}
            onClose={() => setClosingAccount(false)}
            onConfirm={(confirmation) => void perform(async (live) => {
              const result = await currentBackend().closeAccount(confirmation)
              if (!live()) return
              setClosingAccount(false)
              await refreshAccount()
              if (live()) setMessage(`Your account closes on ${longDate(result.closure.closesAt)}. Until then you can keep it from this page.`)
            })}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
