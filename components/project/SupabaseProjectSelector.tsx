"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ProjectItem = { id: string; name: string; region?: string }

type Props = {
  open: boolean
  projects: ProjectItem[]
  selectedId: string
  loading?: boolean
  onClose: () => void
  onChange: (id: string) => void
  onConfirm: () => void
  onCreateNew?: () => void
}

export function SupabaseProjectSelector({
  open,
  projects,
  selectedId,
  loading,
  onClose,
  onChange,
  onConfirm,
  onCreateNew,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="border-border bg-card text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Supabase Project</DialogTitle>
          <DialogDescription>
            Choose which Supabase project this Builder project should use.
          </DialogDescription>
        </DialogHeader>
        {projects.length > 0 ? (
          <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted p-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange(p.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === p.id
                    ? "border-border-strong bg-card text-foreground"
                    : "border-border bg-card text-foreground hover:border-border-strong"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.region || "Unknown region"}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 rounded-[1.5rem] border border-border bg-card p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">No Supabase projects yet</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Create one here and we will link it automatically, or create it in Supabase first and then come back to refresh this list.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Simple steps</p>
              <ol className="space-y-2 text-sm leading-6 text-foreground">
                <li>1. Create a Supabase project here and we will keep the flow moving.</li>
                <li>2. We automatically link it to this website.</li>
                <li>3. If the app needs backend setup, we continue automatically.</li>
              </ol>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-border-strong">
            Cancel
          </Button>
          {projects.length === 0 && onCreateNew ? (
            <Button type="button" variant="outline" onClick={onCreateNew} className="border-border-strong text-foreground">
              Create New Project
            </Button>
          ) : null}
          <Button type="button" onClick={onConfirm} disabled={!selectedId || loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Link Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

