'use client'

import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** A new organisation needs only a name; its handle is derived and members come next. */
export function CreateOrganisationDialog({ open, busy, onCreate, onClose }: { open: boolean; busy: boolean; onCreate: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const inputId = useId()
  useEffect(() => { if (!open) setName('') }, [open])
  const valid = name.trim().length >= 2 && name.trim().length <= 80
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an organisation</DialogTitle>
          <DialogDescription>A shared workspace for your team. You become its owner; invite people from Members, and choose the Teams plan when you are ready to build together.</DialogDescription>
        </DialogHeader>
        <form id="create-organisation" className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) onCreate(name.trim()) }}>
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">Organisation name</label>
          <Input id={inputId} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus placeholder="Acme Labs" />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-organisation" disabled={!valid || busy}>Create organisation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
