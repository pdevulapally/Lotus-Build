export const billingSections = [
  { id: 'plan', label: 'Overview', description: 'Your current plan, billing details and next steps.' },
  { id: 'usage', label: 'Plan usage', description: 'Included allowances and reset dates.' },
  { id: 'on-demand', label: 'Credits & top-ups', description: 'View your credit balance and buy extra AI usage.' },
  { id: 'payments', label: 'Payments & invoices', description: 'Payment details, invoices and cancellation.' },
] as const

export type BillingSection = typeof billingSections[number]['id']

/** Legacy billing URLs now open the corresponding section of Settings. */
export const billingSettingsPages = {
  plan: 'billing',
  usage: 'usage',
  'on-demand': 'on-demand',
  payments: 'billing',
} as const satisfies Record<BillingSection, string>

/** Preserve existing billing links and bring checkout returns straight to their result. */
export function billingSectionFromLocation(hash: string, returningFromCheckout = false): BillingSection {
  const candidate = hash.replace(/^#/, '')
  return billingSections.find(section => section.id === candidate)?.id
    ?? (returningFromCheckout ? 'on-demand' : 'plan')
}
