'use client'

import { useEffect, useId, useState } from 'react'
import { roleDescriptions, roleLabels } from '@/lib/settings/organisations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Invite by email with a role; the link the server sends works for that address only. */
export function InviteMemberDialog({ open, busy, organisationName, onInvite, onClose }: {
  open: boolean; busy: boolean; organisationName: string; onInvite: (email: string, role: 'admin' | 'member') => void; onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const inputId = useId()
  useEffect(() => { if (!open) { setEmail(''); setRole('member') } }, [open])
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {organisationName}</DialogTitle>
          <DialogDescription>They receive an email with a link that works for seven days and only when signed in with this address.</DialogDescription>
        </DialogHeader>
        <form id="invite-member" className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) onInvite(email.trim(), role) }}>
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">Email address</label>
            <Input id={inputId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus inputMode="email" placeholder="name@company.com" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Role</p>
            <Select value={role} onValueChange={(value) => setRole(value as 'admin' | 'member')}>
              <SelectTrigger className="h-9 text-sm" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['member', 'admin'] as const).map((option) => <SelectItem key={option} value={option}>{roleLabels[option]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[13px] text-muted-foreground">{roleDescriptions[role]}</p>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" form="invite-member" disabled={!valid || busy}>Send invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
