'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * GitHub-style confirmation: an exact phrase has to be typed before the action is enabled.
 * The server checks the same phrase; this only keeps a slip of the hand from reaching it.
 */
export function TypedConfirmationDialog({ open, title, phrase, phraseLabel, action, busy, children, onConfirm, onClose, caseSensitive = false, inputMode }: {
  open: boolean
  title: string
  phrase: string
  phraseLabel: string
  action: string
  busy: boolean
  children: ReactNode
  onConfirm: (typed: string) => void
  onClose: () => void
  caseSensitive?: boolean
  inputMode?: 'email' | 'text'
}) {
  const [typed, setTyped] = useState('')
  const inputId = useId()
  useEffect(() => { if (!open) setTyped('') }, [open])
  const normalise = (value: string) => caseSensitive ? value.trim() : value.trim().toLowerCase()
  const matches = normalise(typed) === normalise(phrase)
  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <AlertDialogContent className="border-border bg-card text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {children}
              <p>To confirm, type <span className="select-all font-medium text-foreground">{phrase}</span> below.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (matches && !busy) onConfirm(typed) }}>
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{phraseLabel}</label>
          <Input id={inputId} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} inputMode={inputMode} aria-invalid={typed !== '' && !matches} />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!matches || busy} onClick={(event) => { event.preventDefault(); onConfirm(typed) }}
            className="bg-destructive text-white hover:bg-destructive/90">
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
