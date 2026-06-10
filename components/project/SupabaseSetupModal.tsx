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
      <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-accent-soft p-3">
              <Database className="h-6 w-6 text-accent-soft-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Connect Your Database</DialogTitle>
          <DialogDescription className="text-center">
            {hasOAuthConnection
              ? "Your website needs a Supabase backend. Choose an existing project or create a new one next."
              : "Your website needs a Supabase backend. Connect Supabase first, then we will help you choose or create the project."}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Simple flow</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li>1. Connect your Supabase account.</li>
              <li>2. Pick an existing project or create a new one.</li>
              <li>3. We continue the backend setup for this website.</li>
            </ol>
          </div>

          <Button
            type="button"
            onClick={onConnect}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
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
