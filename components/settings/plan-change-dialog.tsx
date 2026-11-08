'use client'

import { useEffect, useState } from 'react'
import type { BackendPlan } from '@/lib/backend/client'
import { describeChangeCharge, type PlanRelation } from '@/lib/settings/plans'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface PlanChangeRequest { readonly plan: BackendPlan; readonly relation: Extract<PlanRelation, 'upgrade' | 'downgrade'> }
type Preview = { amountDueMinor: number; currency: string }

/**
 * Confirms a plan change with the figure Stripe quotes for it. The preview is
 * fetched when the dialog opens; until it arrives the confirm button waits, so
 * nobody agrees to an amount they have not seen.
 */
export function PlanChangeDialog({ request, busy, preview, onConfirm, onClose }: {
  request: PlanChangeRequest | null
  busy: boolean
  preview: (planKey: string) => Promise<Preview>
  onConfirm: (plan: BackendPlan) => void
  onClose: () => void
}) {
  const [quote, setQuote] = useState<{ planKey: string; text: string } | { planKey: string; error: string } | null>(null)
  useEffect(() => {
    if (request === null) { setQuote(null); return }
    let cancelled = false
    preview(request.plan.key)
      .then((result) => { if (!cancelled) setQuote({ planKey: request.plan.key, text: describeChangeCharge(result) }) })
      .catch((reason: unknown) => { if (!cancelled) setQuote({ planKey: request.plan.key, error: reason instanceof Error ? reason.message : 'The price preview could not be loaded.' }) })
    return () => { cancelled = true }
  }, [request, preview])
  const ready = request !== null && quote !== null && quote.planKey === request.plan.key && 'text' in quote
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent className="border-border bg-card text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.relation === 'upgrade' ? 'Upgrade' : 'Downgrade'} to {request?.plan.name}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>{quote === null || quote.planKey !== request?.plan.key ? 'Checking the price with Stripe…' : 'text' in quote ? quote.text : quote.error}</p>
              <p>The change applies now, and your plan’s allowances update with it.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep current plan</AlertDialogCancel>
          <AlertDialogAction disabled={!ready || busy} onClick={(event) => { event.preventDefault(); if (request) onConfirm(request.plan) }}>
            Confirm {request?.relation}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
