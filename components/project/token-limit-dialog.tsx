"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TokenLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  description?: string
}

export function TokenLimitDialog({
  open,
  onOpenChange,
  description = "This workspace has no credits left in the current cycle. Upgrade to continue generating website updates.",
}: TokenLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em] text-foreground">You&apos;re out of credits</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="border-border-strong text-foreground" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Link href="/pricing">
            <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onOpenChange(false)}>
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
