"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  open: boolean
  tables: string[]
  sql: string
  pushing?: boolean
  generating?: boolean
  error?: string
  onClose: () => void
  onPush: () => void
}

export function SchemaPreviewModal({
  open,
  tables,
  sql,
  pushing,
  generating,
  error,
  onClose,
  onPush,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Database schema ready</DialogTitle>
          <DialogDescription>
            Review detected tables and push SQL schema to Supabase.
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating schema...
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Tables detected</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tables.map((t) => (
                  <span key={t} className="rounded-lg bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
                    {t}
                  </span>
                ))}
                {tables.length === 0 ? <span className="text-xs text-muted-foreground">No tables detected</span> : null}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">View SQL</p>
              <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{sql}</pre>
            </div>
          </>
        )}

        {error ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-border-strong">
            Cancel
          </Button>
          <Button type="button" onClick={onPush} disabled={!sql || generating || pushing} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Push to Supabase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
