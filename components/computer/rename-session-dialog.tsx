"use client"

import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function RenameSessionDialog({
  open, draft, saving, error, onDraftChange, onCancel, onSave,
}: {
  open: boolean
  draft: string
  saving: boolean
  error: string | null
  onDraftChange: (value: string) => void
  onCancel: () => void
  onSave: () => Promise<void>
}) {
  const canSave = !saving && draft.trim().length > 0
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canSave) void onSave()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-[26rem] gap-0 rounded-2xl border-border/60 p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.35)] sm:max-w-[26rem]">
        <form onSubmit={submit}>
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-[16px] font-semibold">Rename project</DialogTitle>
            <DialogDescription className="text-[13px]">Give this project a name you’ll recognise in the sidebar.</DialogDescription>
          </DialogHeader>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            maxLength={120}
            autoFocus
            aria-label="Project name"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "rename-session-error" : undefined}
            className="mt-4 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-[14px] font-medium text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-4 focus:ring-ring/15"
            placeholder="Project name"
          />
          {error && <p id="rename-session-error" role="alert" className="mt-2 text-[12.5px] text-destructive">{error}</p>}
          <DialogFooter className="mt-5 flex-row justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9 rounded-full px-4 text-[13px]" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" className="h-9 rounded-full px-4 text-[13px]" disabled={!canSave}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
