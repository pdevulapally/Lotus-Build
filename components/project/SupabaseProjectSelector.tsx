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
      <DialogContent className="rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Select Supabase Project</DialogTitle>
          <DialogDescription>
            Choose which Supabase project this Builder project should use.
          </DialogDescription>
        </DialogHeader>
        {projects.length > 0 ? (
          <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl bg-muted/50 p-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange(p.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedId === p.id
                    ? "border-primary bg-card text-foreground ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:border-border-strong"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.region || "Unknown region"}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-muted/40 p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">No Supabase projects yet</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Create one here and we will link it automatically, or create it in Supabase first and then come back to refresh this list.
              </p>
            </div>

            <div className="space-y-2 border-t border-border px-4 py-4">
              <p className="text-xs font-semibold text-muted-foreground">Simple steps</p>
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
          <Button type="button" onClick={onConfirm} disabled={!selectedId || loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Link Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
