'use client'

import { useEffect, useState } from 'react'
import type { BackendMember, BackendOrganisation } from '@/lib/backend/client'
import { can, roleLabels } from '@/lib/settings/organisations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsBadge, SettingsRow, SettingsSection } from '../settings-row'

export interface OrganisationGeneralPageProps {
  organisation: BackendOrganisation
  members: readonly BackendMember[] | null
  currentUid: string
  busy: boolean
  onRename: (name: string) => void
  onTransfer: (uid: string) => void
  onLeave: () => void
  onDelete: () => void
}

/** Name, handle and the owner-level actions; what a role cannot do is simply not offered. */
export function OrganisationGeneralPage({ organisation, members, currentUid, busy, onRename, onTransfer, onLeave, onDelete }: OrganisationGeneralPageProps) {
  const [name, setName] = useState(organisation.name)
  const [newOwner, setNewOwner] = useState<string>('')
  useEffect(() => setName(organisation.name), [organisation.name])
  const role = organisation.role
  const candidates = (members ?? []).filter((member) => member.uid !== currentUid)
  return (
    <div>
      <SettingsSection title="Organisation">
        <SettingsRow label="Name" description={can(role, 'rename') ? 'Shown to members and in invitations.' : 'Only owners and admins can rename the organisation.'}>
          {can(role, 'rename') ? (
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (name.trim() !== organisation.name && !busy) onRename(name) }}>
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-8 w-52 text-sm" aria-label="Organisation name" />
              <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim().length < 2 || name.trim() === organisation.name}>Save</Button>
            </form>
          ) : <span className="text-sm">{organisation.name}</span>}
        </SettingsRow>
        <SettingsRow label="Handle" description="Reserved for links; it is not shown anywhere yet."><span className="font-mono text-[13px] text-muted-foreground">{organisation.slug}</span></SettingsRow>
        <SettingsRow label="Your role"><SettingsBadge>{roleLabels[role]}</SettingsBadge></SettingsRow>
        <SettingsRow label="Members" description={organisation.seats > 0 ? `${organisation.seats} paid ${organisation.seats === 1 ? 'seat' : 'seats'}.` : 'No plan yet.'}>
          <span className="tabular-nums text-muted-foreground">{organisation.memberCount}</span>
        </SettingsRow>
      </SettingsSection>

      {can(role, 'transfer') && (
        <SettingsSection title="Ownership" description="The new owner takes over billing and deletion; you stay on as an admin.">
          <SettingsRow label="Transfer ownership">
            <Select value={newOwner} onValueChange={setNewOwner} disabled={busy || candidates.length === 0}>
              <SelectTrigger className="h-8 w-56 text-sm" aria-label="New owner"><SelectValue placeholder={candidates.length === 0 ? 'Invite someone first' : 'Choose a member'} /></SelectTrigger>
              <SelectContent>{candidates.map((member) => <SelectItem key={member.uid} value={member.uid}>{member.displayName ?? member.email}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" disabled={busy || newOwner === ''} onClick={() => onTransfer(newOwner)}>Transfer</Button>
          </SettingsRow>
        </SettingsSection>
      )}

      <SettingsSection title="Danger zone">
        {can(role, 'leave') && (
          <SettingsRow label="Leave organisation" description="You lose access to its projects. An admin can invite you back.">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onLeave}>Leave</Button>
          </SettingsRow>
        )}
        {can(role, 'delete') && (
          <SettingsRow label="Delete organisation" description={organisation.seats > 0 ? 'Cancel the Teams plan first.' : 'Removes every member and invitation. This cannot be undone.'}>
            <Button type="button" size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" disabled={busy || organisation.seats > 0} onClick={onDelete}>Delete…</Button>
          </SettingsRow>
        )}
        {role === 'owner' && organisation.seats === 0 && organisation.memberCount > 1 && (
          <p className="py-3 text-[13px] text-muted-foreground">As the owner you cannot leave; transfer ownership first.</p>
        )}
      </SettingsSection>
    </div>
  )
}
