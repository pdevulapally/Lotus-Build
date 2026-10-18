"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  open: boolean
  loading?: boolean
  error?: string
  onClose: () => void
  onConnect: () => void
}

export function SupabaseConnectModal({ open, loading, error, onClose, onConnect }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Connect Supabase</DialogTitle>
          <DialogDescription>
            Authenticate with Supabase via OAuth to list and link your projects.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-border-strong">
            Cancel
          </Button>
          <Button type="button" onClick={onConnect} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect Supabase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
