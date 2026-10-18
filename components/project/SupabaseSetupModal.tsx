"use client"

import { Loader2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  open: boolean
  loading?: boolean
  hasOAuthConnection?: boolean
  error?: string
  onClose: () => void
  onConnect: () => void
  onProjectsReady?: () => void
}

export function SupabaseSetupModal({ open, loading, hasOAuthConnection, error, onClose, onConnect, onProjectsReady }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center">
            <div className="rounded-xl bg-muted p-3">
              <Database className="h-6 w-6 text-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-semibold tracking-[-0.03em]">Connect Your Database</DialogTitle>
          <DialogDescription className="text-center">
            {hasOAuthConnection
              ? "Your website needs a Supabase backend. Choose an existing project or create a new one next."
              : "Your website needs a Supabase backend. Connect Supabase first, then we will help you choose or create the project."}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p> : null}
        <div className="space-y-4">
          <div className="border-y border-border px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">Simple flow</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li>1. Connect your Supabase account.</li>
              <li>2. Pick an existing project or create a new one.</li>
              <li>3. We continue the backend setup for this website.</li>
            </ol>
          </div>

          <Button
            type="button"
            onClick={onConnect}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {hasOAuthConnection ? "Select Project" : "Connect Supabase"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="w-full border-border-strong">
            Skip for Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
