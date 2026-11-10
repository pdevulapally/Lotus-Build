// Stripe charge units, deliberately independent of Intl/ISO display precision.
// https://docs.stripe.com/currencies#zero-decimal and #special-cases
// https://support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae
const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'])
const threeDecimal = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd'])
export function stripeChargeDigits(currency: string): number {
  const code = currency.toLowerCase()
  return zeroDecimal.has(code) ? 0 : threeDecimal.has(code) ? 3 : 2
}
export function stripeMajorAmount(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** stripeChargeDigits(currency)
}
export function formatStripeAmount(amountMinor: number, currency: string, options: { currencyDisplay?: 'symbol' | 'code'; trimWhole?: boolean } = {}) {
  const code = currency.toLowerCase()
  const digits = stripeChargeDigits(code)
  const amount = stripeMajorAmount(amountMinor, code)
  const minimum = ((options.trimWhole || code === 'isk' || code === 'ugx') && Number.isInteger(amount)) ? 0 : digits
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code, currencyDisplay: options.currencyDisplay ?? 'symbol', minimumFractionDigits: minimum, maximumFractionDigits: digits }).format(amount)
}
