'use client'

import { TypedConfirmationDialog } from './typed-confirmation-dialog'

/** Closing the account needs the account's email typed; the server checks the same thing. */
export function CloseAccountDialog({ open, email, busy, graceDays, onConfirm, onClose }: {
  open: boolean
  email: string
  busy: boolean
  graceDays: number
  onConfirm: (confirmation: string) => void
  onClose: () => void
}) {
  return (
    <TypedConfirmationDialog open={open} title="Close your account" phrase={email} phraseLabel="Your email address" action="Close account" busy={busy}
      inputMode="email" onConfirm={onConfirm} onClose={onClose}>
      <p>Your projects, files and account details will be permanently deleted after {graceDays} days. Until then you can keep the account from Settings, but you cannot start new builds or change your plan.</p>
    </TypedConfirmationDialog>
  )
}
