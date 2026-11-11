export const billingSections = [
  { id: 'plan', label: 'Your plan', description: 'Subscription and plan options.' },
  { id: 'usage', label: 'Plan usage', description: 'Included allowances and reset dates.' },
  { id: 'on-demand', label: 'On-demand usage', description: 'Extra AI credits and one-time top-ups.' },
  { id: 'payments', label: 'Payments & invoices', description: 'Payment details, invoices and cancellation.' },
] as const

export type BillingSection = typeof billingSections[number]['id']

/** Preserve existing billing links and bring checkout returns straight to their result. */
export function billingSectionFromLocation(hash: string, returningFromCheckout = false): BillingSection {
  const candidate = hash.replace(/^#/, '')
  return billingSections.find(section => section.id === candidate)?.id
    ?? (returningFromCheckout ? 'on-demand' : 'plan')
}
