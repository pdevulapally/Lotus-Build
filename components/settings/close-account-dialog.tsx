'use client'

import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * GitHub-style confirmation: the account's email has to be typed before the
 * action is enabled. The server checks the same thing; this only keeps a slip
 * of the hand from reaching it.
 */
export function CloseAccountDialog({ open, email, busy, graceDays, onConfirm, onClose }: {
  open: boolean
  email: string
  busy: boolean
  graceDays: number
  onConfirm: (confirmation: string) => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputId = useId()
  useEffect(() => { if (!open) setTyped('') }, [open])
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()
  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <AlertDialogContent className="border-border bg-card text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>Close your account</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>Your projects, files and account details will be permanently deleted after {graceDays} days. Until then you can keep the account from Settings, but you cannot start new builds or change billing.</p>
              <p>To confirm, type <span className="select-all font-medium text-foreground">{email}</span> below.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (matches && !busy) onConfirm(typed) }}>
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">Your email address</label>
          <Input id={inputId} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} inputMode="email" aria-invalid={typed !== '' && !matches} />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!matches || busy} onClick={(event) => { event.preventDefault(); onConfirm(typed) }}
            className="bg-destructive text-white hover:bg-destructive/90">
            Close account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
