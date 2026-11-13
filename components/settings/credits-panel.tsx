'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, CircleAlert, Clock3, LockKeyhole } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { CreditsController } from '@/hooks/use-credits'
import { creditPrice, creditPurchaseMessage, customAmountMinor, customCreditOffer, type CreditOffer, type CreditTask } from '@/lib/billing/credits'
import { formatStripeAmount } from '@/lib/billing/currency'

const packStyle = 'h-full min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring data-[selected=selected]:border-foreground data-[selected=selected]:bg-muted/50 data-[disabled=disabled]:opacity-50'
const pacingCopy: Record<CreditOffer['pacingPolicy'], string> = {
  respect: 'The daily usage limit still applies.',
  bypass_paid: 'Paid credits can cover usage beyond the daily allowance. Other limits still apply.',
}

/** Shares the billing controller so eligibility, prices and balances stay together. */
export function CreditsPanel({ credits, task, onClose }: { credits: CreditsController; task?: CreditTask; onClose?: () => void }) {
  const { data, loading, unavailable, busy, error, purchaseError, checkoutBlockedReason, purchase, refresh, checkout, canRecoverCheckout, recoverCheckout } = credits
  const [selected, setSelected] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const groupName = useId()
  const custom = data?.customTopUp
  const customQuote = customCreditOffer(custom, custom ? customAmountMinor(customAmount, custom.currency) : null)
  const offer = selected === 'custom-amount' ? customQuote : data?.offers.find(item => `${item.id}:${item.version}` === selected)
  const PaymentIcon = purchase?.status === 'paid' ? CheckCircle2 : purchase?.status === 'pending' ? Clock3 : CircleAlert
  const continuation = purchase?.status === 'paid' ? purchase.continuation : undefined
  const pacingPolicies = new Set([...(data?.offers.map(item => item.pacingPolicy) ?? []), ...(custom ? [custom.pacingPolicy] : [])])
  return <VStack as="section" gap={5} aria-label="On-demand usage" aria-busy={loading || busy}>
    <HStack align="center" justify="between" gap={3} wrap="wrap">
      {data?.wallet && !loading ? <VStack gap={1}>
        <Text type="supporting" color="secondary">Available credits</Text>
        <Text type="label" className="text-2xl font-semibold tracking-tight tabular-nums">{data.wallet.availableCredits.toLocaleString('en-GB')}</Text>
        {data.wallet.reservedCredits > 0 && <Text type="supporting" color="secondary">{data.wallet.reservedCredits.toLocaleString('en-GB')} in progress</Text>}
      </VStack> : <Text type="supporting" color="secondary">Your credit balance</Text>}
      <Button label="Refresh credits" variant="ghost" size="sm" isDisabled={loading || busy} onClick={() => void refresh()} />
    </HStack>
    <Text type="supporting" color="secondary">{data?.purchasing.enabled ? 'Buy extra AI credits with a one-time payment. Your subscription stays the same.' : 'Extra AI credits let you continue after your included allowance.'}</Text>
    {loading && <Text type="body" color="secondary" role="status">Loading on-demand usage…</Text>}
    {unavailable && !loading && <VStack gap={2} role="status">
      <HStack gap={2} align="center"><CircleAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><Text type="label">Top-ups couldn’t be loaded</Text></HStack>
      <Text type="supporting" color="secondary">Try again in a moment.</Text>
      <Button label="Try again" size="sm" isDisabled={busy} onClick={() => void refresh()} />
    </VStack>}
    {(error || purchaseError) && <HStack gap={3} align="center" justify="between" wrap="wrap" role="alert" className="rounded-lg bg-muted p-4">
      <Text type="body">{purchaseError ? 'Payment status unavailable' : 'Credits couldn’t be loaded'}</Text>
      <Button label="Try again" isDisabled={loading || busy} onClick={() => void refresh()} />
    </HStack>}
    {checkoutBlockedReason && !error && !purchaseError && <Text type="supporting" color="secondary" role="status">Check your previous checkout before buying more credits.</Text>}
    {canRecoverCheckout && <Button label="Resume previous checkout" isDisabled={loading || busy} onClick={() => void recoverCheckout()} />}
    {purchase && <VStack gap={3} role="status" className="rounded-xl border border-border p-4">
      <HStack gap={3} align="center"><PaymentIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Text type="label">{creditPurchaseMessage(purchase)}</Text></HStack>
      {continuation && <HStack gap={3} align="center" justify="between" wrap="wrap">
        <Text type="supporting" color="secondary">{continuation.status === 'queued' || continuation.status === 'active' ? 'Your task is continuing.'
          : continuation.status === 'finished' ? 'Your task has finished.' : 'Credits added. Open your task to continue.'}</Text>
        <Button label="View task" as={Link} href={`/computer/${encodeURIComponent(continuation.sessionId)}`} onClick={onClose} />
      </HStack>}
    </VStack>}
    {data && !loading && <>
      {!data.wallet && <Text type="supporting" color="secondary">Credit balance is unavailable.</Text>}
      {!data.purchasing.enabled || data.offers.length === 0 ? <VStack gap={2} role="status">
        <HStack gap={2} align="center"><CircleAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><Text type="label">Top-ups are temporarily unavailable</Text></HStack>
        <Button label="Try again" size="sm" isDisabled={busy} onClick={() => void refresh()} />
      </VStack> : <>
          <RadioList label="Choose a credit pack" description="Choose an amount to add to your balance." value={selected ?? ''} onChange={setSelected}
            controlClassName="grid grid-cols-1 gap-3 @sm:grid-cols-2"
            htmlName={groupName} isDisabled={busy || Boolean(checkoutBlockedReason)} aria-describedby={`${groupName}-terms`}>
            {data.offers.map(item => <RadioListItem key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}
              className={packStyle}
              label={<VStack as="span" gap={2}>
                <Text as="span" type="label" className="font-semibold tabular-nums">{item.credits.toLocaleString('en-GB')} credits</Text>
                <Text as="span" type="supporting" color="secondary">{creditPrice(item)} <span className="text-muted-foreground">one-time</span></Text>
              </VStack>} />)}
            {custom && <RadioListItem value="custom-amount" className={packStyle}
              label={<VStack as="span" gap={2}>
                <Text as="span" type="label" className="font-semibold">Custom amount</Text>
                <Text as="span" type="supporting" color="secondary">Choose how much to add.</Text>
              </VStack>} />}
          </RadioList>
        {custom && selected === 'custom-amount' && <TextInput label={`Amount (${custom.currency.toUpperCase()})`} value={customAmount} onChange={setCustomAmount}
          ref={input => { if (input) input.inputMode = 'decimal' }} isDisabled={busy || Boolean(checkoutBlockedReason)}
          description={`${formatStripeAmount(custom.minAmountMinor, custom.currency)}–${formatStripeAmount(custom.maxAmountMinor, custom.currency)}, in ${formatStripeAmount(custom.stepAmountMinor, custom.currency)} increments.`}
          status={customAmount && !customQuote ? {type:'error',message:'Choose an amount within the range and increment shown.'} : undefined} />}
        <VStack gap={4} className="border-t border-border pt-5">
          <HStack align="center" justify="between" gap={3} wrap="wrap" role="status">
            <Text type="supporting" color="secondary">{offer ? `${offer.credits.toLocaleString('en-GB')} credits` : 'Select a credit pack to continue.'}</Text>
            {offer && <Text type="label" className="font-semibold tabular-nums">{creditPrice(offer)}</Text>}
          </HStack>
          {task && !continuation && <Text type="supporting" color="secondary">Your paused task will continue after payment is confirmed.</Text>}
          <Button label={busy ? 'Opening checkout…' : task ? 'Buy credits and continue' : 'Continue to checkout'} variant="primary" width="100%" isDisabled={!offer || busy || Boolean(checkoutBlockedReason)} onClick={() => { if (offer) void checkout(offer) }} />
          <HStack gap={2} align="center" justify="center"><LockKeyhole className="size-3.5 text-muted-foreground" aria-hidden="true" /><Text type="supporting" color="secondary">Secure checkout with Stripe</Text></HStack>
          <VStack gap={2} id={`${groupName}-terms`}>
            <Text type="supporting" color="secondary">Credits never expire. One-time purchase, not an automatic top-up. Your subscription stays the same.</Text>
            <Text type="supporting" color="secondary">Credits are added only after payment is verified. Credits cover AI usage, not storage or other plan features.</Text>
            {[...pacingPolicies].map(policy => <Text key={policy} type="supporting" color="secondary">{pacingCopy[policy]}</Text>)}
          </VStack>
        </VStack>
      </>}
    </>}
  </VStack>
}
