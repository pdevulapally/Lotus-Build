import { seatReviewReasons, type BackendSeatRecovery, type BackendWorkspace, type OrganisationRole } from '@/lib/backend/client'

/** What each role may do, in one place; pages read this rather than comparing roles themselves. */
export const organisationActions = ['rename', 'invite', 'manageMembers', 'viewBilling', 'manageBilling', 'transfer', 'delete', 'leave'] as const
export type OrganisationAction = (typeof organisationActions)[number]

const allowed: Readonly<Record<OrganisationAction, readonly OrganisationRole[]>> = {
  rename: ['owner', 'admin'],
  invite: ['owner', 'admin'],
  manageMembers: ['owner', 'admin'],
  viewBilling: ['owner', 'admin'],
  manageBilling: ['owner'],
  transfer: ['owner'],
  delete: ['owner'],
  leave: ['admin', 'member'],
}

export const can = (role: OrganisationRole, action: OrganisationAction): boolean => allowed[action].includes(role)

export const roleLabels: Readonly<Record<OrganisationRole, string>> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
export const roleDescriptions: Readonly<Record<OrganisationRole, string>> = {
  owner: 'Everything, including billing and deleting the organisation.',
  admin: 'Invites and manages members and settings; cannot change billing.',
  member: 'Works on the organisation’s projects.',
}

/** The organisations in an account's workspace list, personal excluded. */
export const organisationWorkspaces = (workspaces: readonly BackendWorkspace[]) => workspaces.filter((workspace) => workspace.kind === 'organisation')

/** The fewest seats a plan accepts for this organisation: its own floor, or everyone already in it. */
export const minimumSeats = (minSeats: number, memberCount: number) => Math.max(minSeats, memberCount)

/** "£40 per seat / month" from a per-seat price. */
export function formatSeatPrice(price: { amountMinor: number; currency: string; interval: string }): string {
  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: price.currency.toUpperCase(), minimumFractionDigits: price.amountMinor % 100 === 0 ? 0 : 2 }).format(price.amountMinor / 100)
  return `${amount} per seat / ${price.interval}`
}

/** What N seats cost per interval, for the confirmation copy. */
export function formatSeatsTotal(price: { amountMinor: number; currency: string; interval: string }, seats: number): string {
  const total = new Intl.NumberFormat('en-GB', { style: 'currency', currency: price.currency.toUpperCase(), minimumFractionDigits: (price.amountMinor * seats) % 100 === 0 ? 0 : 2 }).format((price.amountMinor * seats) / 100)
  return `${total} / ${price.interval} for ${seats} ${seats === 1 ? 'seat' : 'seats'}`
}

/** What the owner is told after asking to finish a pending seat change — from the server's answer, never a guess. */
export const seatReviewCopy: Readonly<Record<(typeof seatReviewReasons)[number], string>> = {
  'subscription-replaced': 'The plan this change was made against has since been replaced, so it cannot be applied as it was.',
  'key-expired': 'This change is older than Stripe will honour, so it cannot be applied as it was.',
  'request-unknown': 'The details of this change were not kept, so it cannot be applied as it was.',
  'session-not-found': 'The payment page for this change could not be found at Stripe.',
  'no-subscription': 'This organisation has no plan at Stripe to apply the change to.',
}
export type SeatRecoveryOutcome = { kind: 'resolved'; message: string } | { kind: 'checkout'; message: string; url: string | null } | { kind: 'review'; message: string }
export function describeSeatRecovery(result: BackendSeatRecovery): SeatRecoveryOutcome {
  const { pending, subscription } = result
  if (pending === null) {
    return { kind: 'resolved', message: subscription === null ? 'Nothing is pending. This organisation has no plan.' : `Nothing is pending. The plan has ${subscription.seats} ${subscription.seats === 1 ? 'seat' : 'seats'}.` }
  }
  if (pending.review !== undefined) {
    return { kind: 'review', message: `${seatReviewCopy[pending.review]} Support can resolve it with reference ${pending.operation.stripeKey}.` }
  }
  if (pending.kind === 'checkout') return { kind: 'checkout', message: `A payment for ${pending.seats} ${pending.seats === 1 ? 'seat' : 'seats'} is still open.`, url: pending.url ?? null }
  return { kind: 'review', message: `A change to ${pending.seats} seats is still being applied. Try again in a moment.` }
}

/** What the owner was told, remembered with who asked and for which organisation, so it is never shown to anyone else. */
export interface StoredSeatRecovery { readonly principal: string; readonly organisationId: string; readonly outcome: SeatRecoveryOutcome }

/** The stored outcome is visible only to the principal who asked, on the organisation they asked about. */
export const visibleRecovery = (stored: StoredSeatRecovery | null, principal: string, organisationId: string | null): SeatRecoveryOutcome | null =>
  stored !== null && stored.principal === principal && stored.organisationId === organisationId ? stored.outcome : null

/**
 * The owner's "Finish pending change": ask the organisation to reconcile, reload the *organisation's* state (its
 * billing is loaded with the organisation, not with the personal account), then present what the server found.
 * An open payment is presented as an explicit link the owner clicks — never an automatic `window.open` after
 * awaits, which browsers may block, leaving "payment still open" with nothing to click. Every step after an
 * await is fenced by `live`.
 */
export async function finishPendingSeatChange(deps: {
  readonly reconcile: () => Promise<BackendSeatRecovery>
  readonly reloadOrganisation: () => Promise<void>
  readonly live: () => boolean
  readonly present: (outcome: SeatRecoveryOutcome) => void
}): Promise<void> {
  const outcome = describeSeatRecovery(await deps.reconcile())
  if (!deps.live()) return
  await deps.reloadOrganisation()
  if (!deps.live()) return
  deps.present(outcome)
}
