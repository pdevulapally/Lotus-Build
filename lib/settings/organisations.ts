import type { BackendWorkspace, OrganisationRole } from '@/lib/backend/client'

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
