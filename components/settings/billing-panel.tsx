'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Divider } from '@astryxdesign/core/Divider'
import { HStack } from '@astryxdesign/core/HStack'
import { StackItem } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { BackendAccount } from '@/lib/backend/client'
import type { BillingSummaryState } from '@/hooks/use-billing-summary'
import type { CreditsController } from '@/hooks/use-credits'
import { BillingPortalAction, PaymentManagement } from '@/components/billing/payment-management'
import { CreditBalance } from '@/components/billing/credit-balance'
import { billingDate, subscriptionPrice, subscriptionStatus, subscriptionTaxLabels } from '@/lib/billing/format'
import { SettingsRow } from './settings-primitives'

export function SubscriptionSummary({ account, summary, action }: { account: BackendAccount; summary: BillingSummaryState; action?: ReactNode }) {
  const { subscription, loading, error } = summary
  return <VStack as="section" aria-label="Subscription" gap={3}>
    <HStack className="settings-row" align="center" justify="between" gap={4} wrap="wrap">
      <StackItem size="fill">
        <VStack gap={1}>
          <HStack align="center" gap={2} wrap="wrap">
            <Heading level={3}>{account.plan.name} plan</Heading>
            {!loading && !error && subscription && <Badge label={subscriptionStatus(subscription)} />}
          </HStack>
          {loading ? <Text type="supporting" color="secondary" role="status">Loading subscription details...</Text> : error ?
            <Text type="supporting" color="secondary" role="alert">Subscription details are unavailable. You can still open Stripe billing to review your account.</Text> : subscription ? <>
              <Text type="body">{subscriptionPrice(subscription)}</Text>
              <Text type="supporting" color="secondary">{subscription.cancelAt || subscription.cancelAtPeriodEnd ? 'Scheduled cancellation' : 'Current period ends'}: {billingDate(subscription.cancelAt ?? subscription.currentPeriodEnd)} (UTC)</Text>
            </> : <Text type="supporting" color="secondary">No active paid subscription.</Text>}
        </VStack>
      </StackItem>
      {action}
    </HStack>
    {!loading && !error && subscription && <Collapsible trigger="Price details" defaultIsOpen={false}>
      <VStack gap={3} paddingBlock={3}>
        {subscription.planKey !== account.plan.key && <SettingsRow label="Billed subscription"><Text type="body">{subscription.planName}</Text></SettingsRow>}
        <SettingsRow label="Billing period (UTC)"><Text type="body">{billingDate(subscription.currentPeriodStart)} - {billingDate(subscription.currentPeriodEnd)}</Text></SettingsRow>
        <SettingsRow label="Currency"><Text type="body">{subscription.price.currency.toUpperCase()}</Text></SettingsRow>
        <SettingsRow label="Quantity"><Text type="body">{subscription.price.quantity.toLocaleString('en-GB')}</Text></SettingsRow>
        <SettingsRow label="Tax"><Text type="body">{subscriptionTaxLabels[subscription.price.taxBehavior]}</Text></SettingsRow>
        <SettingsRow label="Discounts"><Text type="body">{subscription.discountsApplied ? 'Applied; see invoice for amounts' : 'None applied'}</Text></SettingsRow>
        <Text type="supporting" color="secondary">Base recurring price. Final invoices may reflect taxes, discounts, credits or prorations.</Text>
        <Text type="supporting" color="secondary">Plan usage resets separately from your billing period. See Usage for allowance reset dates.</Text>
      </VStack>
    </Collapsible>}
  </VStack>
}

export function BillingPanel({ account, summary, credits, portal, onOpenCredits, onClose }: {
  account: BackendAccount
  summary: BillingSummaryState
  credits: CreditsController
  portal: ComponentProps<typeof PaymentManagement>['portal']
  onOpenCredits: () => void
  onClose: () => void
}) {
  return <VStack gap={8}>
    <SubscriptionSummary account={account} summary={summary} action={portal.available === false ?
      <Button as={Link} href="/pricing" label="Compare plans" onClick={onClose} /> :
      <BillingPortalAction {...portal} label="Adjust plan" />} />
    <PaymentManagement portal={portal} noSubscription={!summary.loading && !summary.error && !summary.subscription} />
    <VStack gap={3}>
      <Divider />
      <CreditBalance credits={credits} onBuy={onOpenCredits} />
    </VStack>
  </VStack>
}
