'use client'

import { UserPlus, X } from 'lucide-react'
import type { BackendInvitation, BackendMember, BackendOrganisation } from '@/lib/backend/client'
import { can, roleLabels } from '@/lib/settings/organisations'
import { longDate } from '@/lib/settings/plans'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsBadge, SettingsRow, SettingsSection } from '../settings-row'

export interface OrganisationMembersPageProps {
  organisation: BackendOrganisation
  members: readonly BackendMember[] | null
  invitations: readonly BackendInvitation[] | null
  currentUid: string
  busy: boolean
  onInvite: () => void
  onChangeRole: (uid: string, role: 'admin' | 'member') => void
  onRemove: (member: BackendMember) => void
  onRevoke: (invitation: BackendInvitation) => void
}

/** Who is in the organisation and who has been asked; admins change roles, the owner's row is fixed. */
export function OrganisationMembersPage({ organisation, members, invitations, currentUid, busy, onInvite, onChangeRole, onRemove, onRevoke }: OrganisationMembersPageProps) {
  const role = organisation.role
  const manage = can(role, 'manageMembers')
  const seatsLine = organisation.seats > 0 ? `${organisation.memberCount} of ${organisation.seats} seats used.` : `${organisation.memberCount} ${organisation.memberCount === 1 ? 'member' : 'members'}.`
  return (
    <div>
      <SettingsSection title="Members" description={seatsLine}>
        {members === null ? <p className="py-3 text-sm text-muted-foreground">Loading members…</p> : members.map((member) => {
          const self = member.uid === currentUid
          const label = member.displayName ?? member.email
          return (
            <SettingsRow key={member.uid} label={self ? `${label} (you)` : label} description={member.displayName ? member.email : `Joined ${longDate(member.joinedAt)}`}>
              {member.role === 'owner' || !manage || self ? (
                <SettingsBadge>{roleLabels[member.role]}</SettingsBadge>
              ) : (
                <>
                  <Select value={member.role} onValueChange={(value) => onChangeRole(member.uid, value as 'admin' | 'member')} disabled={busy}>
                    <SelectTrigger className="h-8 w-32 text-sm" aria-label={`Role for ${label}`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="member">Member</SelectItem></SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onRemove(member)} aria-label={`Remove ${label}`}><X aria-hidden="true" /></Button>
                </>
              )}
            </SettingsRow>
          )
        })}
        {can(role, 'invite') && (
          <SettingsRow label="Invite someone" description="They get an email with a link that works for their address only.">
            <Button type="button" size="sm" disabled={busy} onClick={onInvite}><UserPlus aria-hidden="true" />Invite</Button>
          </SettingsRow>
        )}
      </SettingsSection>

      {can(role, 'invite') && invitations !== null && invitations.length > 0 && (
        <SettingsSection title="Pending invitations">
          {invitations.map((invitation) => (
            <SettingsRow key={invitation.id} label={invitation.email} description={`${roleLabels[invitation.role]} · expires ${longDate(invitation.expiresAt)}`}>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onRevoke(invitation)}>Revoke</Button>
            </SettingsRow>
          ))}
        </SettingsSection>
      )}
    </div>
  )
}
