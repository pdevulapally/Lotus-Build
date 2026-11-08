'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendInvitation, BackendMember, BackendOrganisation, BackendOrganisationBilling, BackendPlan, BackendSubscription, BackendUsage, BackendWorkspace } from '@/lib/backend/client'
import { longDate } from '@/lib/settings/plans'
import { can } from '@/lib/settings/organisations'
import { CreateOrganisationDialog } from './organisation/create-organisation-dialog'
import { InviteMemberDialog } from './organisation/invite-member-dialog'
import { TypedConfirmationDialog } from './typed-confirmation-dialog'
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
  billing: BackendOrganisationBilling | null; usage: BackendUsage | null; currentUid: string
  onRename: (name: string) => void; onTransfer: (uid: string) => void; onLeave: () => void; onDelete: () => void
  onInvite: () => void; onChangeRole: (uid: string, role: 'admin' | 'member') => void; onRemove: (member: BackendMember) => void; onRevoke: (invitation: BackendInvitation) => void
  onCheckout: (planKey: string, seats: number) => void; onChangeSeats: (seats: number) => void; onManageBilling: () => void
}
/** Page props for the selected organisation; null pages until it has loaded. */
function organisationSettings(h: OrganisationHandlers): OrganisationSettings {
  if (h.organisation === null) return { general: null, members: null, plan: null, usage: null }
  return {
    general: { organisation: h.organisation, members: h.members, currentUid: h.currentUid, onRename: h.onRename, onTransfer: h.onTransfer, onLeave: h.onLeave, onDelete: h.onDelete },
    members: { organisation: h.organisation, members: h.members, invitations: h.invitations, currentUid: h.currentUid, onInvite: h.onInvite, onChangeRole: h.onChangeRole, onRemove: h.onRemove, onRevoke: h.onRevoke },
    plan: { organisation: h.organisation, billing: h.billing, onCheckout: h.onCheckout, onChangeSeats: h.onChangeSeats, onManageBilling: h.onManageBilling },
    usage: h.usage,
  }
}

/**
 * Settings as a modal over whatever the user is doing. The surface follows the
 * surrounding theme; the panel inside knows nothing of auth or the backend,
 * which stay here with the busy/message/error state they produce.
 */
export function SettingsDialog({ open, onOpenChange, initialPage = 'account' }: { open: boolean; onOpenChange: (value: boolean) => void; initialPage?: SettingsPage }) {
  const { user, account, usage, accountError, refreshAccount, workspaces, currentWorkspace, switchWorkspace } = useAuth()
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
  const [orgUsage, setOrgUsage] = useState<BackendUsage | null>(null)
  const [orgRevision, setOrgRevision] = useState(0)
  const [creatingOrganisation, setCreatingOrganisation] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deletingOrganisation, setDeletingOrganisation] = useState(false)
  const [removing, setRemoving] = useState<BackendMember | null>(null)
  useEffect(() => {
    setOrganisation(null); setMembers(null); setInvitations(null); setOrgBilling(null); setOrgUsage(null)
    if (!open || orgId === null) return
    const controller = new AbortController()
    void (async () => {
      try {
        const backend = currentBackend()
        const current = await backend.organisation(orgId, controller.signal)
        if (controller.signal.aborted) return
        setOrganisation(current)
        const [people, pending, billing, pooled] = await Promise.all([
          backend.organisationMembers(orgId, controller.signal),
          can(current.role, 'invite') ? backend.organisationInvitations(orgId, controller.signal) : Promise.resolve({ invitations: [] as readonly BackendInvitation[] }),
          can(current.role, 'viewBilling') ? backend.organisationBilling(orgId, controller.signal) : Promise.resolve(null),
          // Pooled usage is visible to every member; the server refuses anyone else.
          backend.usage(controller.signal, orgId).catch(() => null),
        ])
        if (controller.signal.aborted) return
        setMembers(people.members); setInvitations(pending.invitations); setOrgBilling(billing); setOrgUsage(pooled)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The organisation could not be loaded.')
      }
    })()
    return () => controller.abort()
  }, [open, orgId, orgRevision])
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
          onRefresh={() => void perform(async () => { await refreshAccount(); if (orgId !== null) setOrgRevision((value) => value + 1) })}
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
          workspaces={workspaces}
          workspace={currentWorkspace}
          onSelectWorkspace={(workspace: BackendWorkspace) => void perform(async () => { await switchWorkspace(workspace.id) })}
          onCreateOrganisation={() => { setError(null); setMessage(null); setCreatingOrganisation(true) }}
          organisation={organisationSettings({
            organisation, members, invitations, billing: orgBilling, usage: orgUsage, currentUid: account?.uid ?? '',
            onRename: (name) => void perform(async () => { if (orgId) { await currentBackend().renameOrganisation(orgId, name); await reloadOrganisation(); setMessage('Organisation renamed.') } }),
            onTransfer: (uid) => void perform(async () => { if (orgId) { await currentBackend().transferOwnership(orgId, uid); await reloadOrganisation(); setMessage('Ownership transferred. You are now an admin.') } }),
            onLeave: () => void perform(async () => { if (orgId) { await currentBackend().leaveOrganisation(orgId); const personal = workspaces.find((w) => w.kind === 'personal'); if (personal) await switchWorkspace(personal.id); await refreshAccount(); setMessage('You left the organisation.') } }),
            onDelete: () => { setError(null); setMessage(null); setDeletingOrganisation(true) },
            onInvite: () => { setError(null); setMessage(null); setInviting(true) },
            onChangeRole: (uid, role) => void perform(async () => { if (orgId) { await currentBackend().changeMemberRole(orgId, uid, role); await reloadOrganisation() } }),
            onRemove: (member) => { setError(null); setMessage(null); setRemoving(member) },
            onRevoke: (invitation) => void perform(async () => { if (orgId) { await currentBackend().revokeInvitation(orgId, invitation.id); await reloadOrganisation(); setMessage('Invitation revoked.') } }),
            onCheckout: (planKey, seats) => void perform(async () => { if (orgId) { const result = await currentBackend().organisationCheckout(orgId, planKey, seats); window.location.assign(result.url) } }),
            onChangeSeats: (seats) => void perform(async () => { if (orgId) { const result = await currentBackend().changeSeats(orgId, seats); await reloadOrganisation(); setMessage(`${result.subscription.seats} seats from now on.`) } }),
            onManageBilling: () => void perform(async () => { if (orgId) { const result = await currentBackend().organisationPortal(orgId); window.location.assign(result.url) } }),
          })}
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
        <CreateOrganisationDialog open={creatingOrganisation} busy={busy} onClose={() => setCreatingOrganisation(false)}
          onCreate={(name) => void perform(async () => {
            const created = await currentBackend().createOrganisation(name, `create-organisation-${crypto.randomUUID()}`)
            setCreatingOrganisation(false)
            await refreshAccount()
            await switchWorkspace(created.id)
            setPage('org-members')
            setMessage(`${created.name} is ready. Invite your team, then choose the Teams plan.`)
          })} />
        {organisation && (
          <InviteMemberDialog open={inviting} busy={busy} organisationName={organisation.name} onClose={() => setInviting(false)}
            onInvite={(email, role) => void perform(async () => {
              const invitation = await currentBackend().inviteMember(organisation.id, email, role)
              setInviting(false)
              await reloadOrganisation()
              setMessage(`Invitation sent to ${invitation.email}.`)
            })} />
        )}
        {organisation && (
          <TypedConfirmationDialog open={deletingOrganisation} title={`Delete ${organisation.name}`} phrase={organisation.name} phraseLabel="Organisation name" action="Delete organisation"
            busy={busy} caseSensitive onClose={() => setDeletingOrganisation(false)}
            onConfirm={(typed) => void perform(async () => {
              await currentBackend().deleteOrganisation(organisation.id, typed)
              setDeletingOrganisation(false)
              const personal = workspaces.find((w) => w.kind === 'personal')
              if (personal) await switchWorkspace(personal.id)
              await refreshAccount()
              setMessage('Organisation deleted.')
            })}>
            <p>Every member loses access and pending invitations stop working. This cannot be undone.</p>
          </TypedConfirmationDialog>
        )}
        {organisation && removing && (
          <TypedConfirmationDialog open title={`Remove ${removing.displayName ?? removing.email}`} phrase={removing.email} phraseLabel="Their email address" action="Remove member"
            busy={busy} inputMode="email" onClose={() => setRemoving(null)}
            onConfirm={() => void perform(async () => {
              await currentBackend().removeMember(organisation.id, removing.uid)
              setRemoving(null)
              await reloadOrganisation()
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
