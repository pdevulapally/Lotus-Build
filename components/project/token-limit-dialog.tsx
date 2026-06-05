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
      <DialogContent className="max-w-md border-zinc-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-foreground">You&apos;re out of credits</DialogTitle>
          <DialogDescription className="text-zinc-600">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="border-zinc-300 text-zinc-700" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Link href="/pricing">
            <Button type="button" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onOpenChange(false)}>
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
