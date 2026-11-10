import type { BillingCredits, CreditPurchase } from './credits'
import type { CreditOperation } from './credits-checkout'

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

/** Discover the server's active intent, reconcile it, then read the resulting wallet. */
export async function readCreditsSnapshot(options: {
  readWallet: () => Promise<BillingCredits>
  readPurchase: (id: string) => Promise<CreditPurchase>
  readOperation: () => CreditOperation | null
  purchaseId?: string | null
}) {
  let operation: CreditOperation | null = null
  let operationError: string | null = null
  let data: BillingCredits | null = null
  let purchase: CreditPurchase | null = null
  let error: string | null = null
  let purchaseError: string | null = null
  try { operation = options.readOperation() } catch { operationError = 'Saved checkout information could not be read. Restore browser storage before starting another purchase.' }
  try { data = await options.readWallet() } catch (failure) { error = message(failure, 'On-demand usage could not be loaded.') }
  // Server active intent is authoritative even in another tab or with missing browser storage.
  const id = data?.pendingPurchaseId ?? operation?.purchaseId ?? options.purchaseId
  if (id) {
    try {
      const result = await options.readPurchase(id)
      if (result.purchaseId !== id) throw new Error('The returned purchase did not match this checkout.')
      purchase = result
    } catch (failure) { purchaseError = `Payment status could not be checked. ${message(failure, 'Refresh to try again.')}` }
    // Reconciliation can grant/revoke credits, even before reporting a transient failure.
    // Never pair the pre-reconciliation balance with the resulting payment status.
    data = null
    try { data = await options.readWallet(); error = null } catch (failure) { error = message(failure, 'The updated credit balance could not be loaded.') }
  }
  const unresolvedOperation = operation && (!operation.purchaseId || operation.purchaseId !== purchase?.purchaseId || purchase.status === 'pending')
  const unavailableOperation = operation && unresolvedOperation && !data?.offers.some(offer => offer.id === operation.offerId && offer.version === operation.offerVersion)
  const checkoutBlockedReason = operationError ?? (purchaseError
    ? 'Payment status is unavailable. Refresh to check your earlier checkout before starting another payment.'
    : purchase?.status === 'pending' || data?.pendingPurchaseId
      ? 'An earlier payment is still pending. Finish that checkout or refresh its status before starting another.'
      : unavailableOperation
        ? 'Your earlier checkout needs to be checked before another top-up. Refresh its status. If it remains unavailable, contact billing support; do not start another payment.'
        : null)
  return { data, purchase, operation, error, purchaseError, checkoutBlockedReason, canRecoverCheckout: operation !== null && !operationError }
}
