'use client'

import { useId, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { CreditsController } from '@/hooks/use-credits'
import { creditExpiry, creditPrice, creditPurchaseMessage } from '@/lib/billing/credits'
import { CreditBalance } from '@/components/billing/credit-balance'
import { SettingsGroup } from './settings-primitives'

/** Shares the billing controller so eligibility, prices and balances stay together. */
export function CreditsPanel({ credits }: { credits: CreditsController }) {
  const { data, loading, unavailable, busy, error, purchaseError, checkoutBlockedReason, purchase, refresh, checkout, canRecoverCheckout, recoverCheckout } = credits
  const [selected, setSelected] = useState<string | null>(null)
  const groupName = useId()
  const offer = data?.offers.find(item => `${item.id}:${item.version}` === selected)
  return <VStack as="section" gap={4} aria-label="On-demand usage" aria-busy={loading || busy}>
    <HStack align="center" justify="between" gap={3} wrap="wrap">
      <Heading level={3}>AI credits</Heading>
      <Button label="Refresh credits" isDisabled={loading || busy} onClick={() => void refresh()} />
    </HStack>
    <Text type="supporting" color="secondary">{data?.purchasing.enabled ? 'Buy extra AI credits with a one-time payment. Your subscription stays the same.' : 'Extra AI credits let you continue after your included allowance.'}</Text>
    {loading && <Text type="body" color="secondary" role="status">Loading on-demand usage…</Text>}
    {unavailable && !loading && <Text type="body" color="secondary" role="status">On-demand usage is not available yet. Your plan and billing options are still available.</Text>}
    {error && <Text type="body" role="alert" className="text-destructive">{error}</Text>}
    {purchaseError && <Text type="body" role="alert" className="text-destructive">{purchaseError}</Text>}
    {checkoutBlockedReason && <Text type="body" color="secondary" role="status">{checkoutBlockedReason}</Text>}
    {canRecoverCheckout && <Button label="Resume previous checkout" isDisabled={loading || busy} onClick={() => void recoverCheckout()} />}
    {purchase && <Text type="body" role="status">{creditPurchaseMessage(purchase)}</Text>}
    {data && !loading && <>
      <CreditBalance credits={credits} showAction={false} />
      {!data.purchasing.enabled ? <Text type="body" color="secondary">{data.purchasing.reason || 'Top-ups are not available for this account.'}</Text> : data.offers.length === 0 ? <Text type="body" color="secondary">No top-up options are available right now.</Text> : <>
        <SettingsGroup title="Buy credits">
          <RadioList label="Choose a credit pack" description="Review the payment in Stripe before you pay." value={selected ?? ''} onChange={setSelected}
            htmlName={groupName} isDisabled={busy || Boolean(checkoutBlockedReason)} aria-describedby={`${groupName}-terms`}>
            {data.offers.map(item => <RadioListItem key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}
              label={`${item.credits.toLocaleString('en-GB')} credits`}
              endContent={<Text type="label">{creditPrice(item)} once</Text>}
              description={`${creditExpiry(item)} ${item.pacingPolicy === 'respect' ? 'The daily usage limit still applies.' : 'Paid credits can cover usage beyond the daily allowance. Other limits still apply.'}`} />)}
          </RadioList>
        </SettingsGroup>
        <VStack gap={3}>
          <Text type="label" role="status">{offer ? `${offer.credits.toLocaleString('en-GB')} credits for ${creditPrice(offer)}, one-time payment` : 'Select a credit pack to continue.'}</Text>
          <Text type="supporting" color="secondary" id={`${groupName}-terms`}>One-time purchase, not an automatic top-up. Credits are added only after payment is verified. Credits cover AI usage, not storage or other plan features.</Text>
          <Button label={busy ? 'Opening checkout…' : 'Continue to checkout'} variant="primary" isDisabled={!offer || busy || Boolean(checkoutBlockedReason)} onClick={() => { if (offer) void checkout(offer) }} />
        </VStack>
      </>}
    </>}
  </VStack>
}
