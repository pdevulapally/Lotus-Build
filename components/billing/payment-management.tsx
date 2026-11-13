'use client'

import Link from 'next/link'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { StackItem } from '@astryxdesign/core/Stack'
import { Icon } from '@astryxdesign/core/Icon'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

type PortalProps = { available: boolean | undefined; loading: boolean; busy: boolean; onOpen: () => void }

export function BillingPortalAction({ available, loading, busy, onOpen, label = 'Open Stripe billing' }: PortalProps & { label?: string }) {
  if (available === false) return <Text type="body" color="secondary">You do not have a Stripe billing account yet. <Link href="/pricing" className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Compare plans</Link> or choose an available top-up to get started.</Text>
  return <Button label={busy ? 'Opening Stripe…' : label} variant="secondary" isDisabled={loading || busy} isLoading={busy} onClick={onOpen}
    aria-label={`${busy ? 'Opening Stripe' : label} (opens Stripe)`} endContent={<Icon icon="externalLink" size="sm" />} />
}

export function PaymentManagement({ portal, noSubscription }: { portal: PortalProps; noSubscription: boolean }) {
  return <VStack as="section" aria-label="Payments and cancellation" gap={8}>
    <HStack as="section" className="settings-row" aria-label="Payment" align="start" justify="between" gap={4} wrap="wrap">
      <StackItem size="fill"><VStack gap={1}>
        <Heading level={3}>Payment</Heading>
        <Text type="supporting" color="secondary">Manage your payment methods and billing information in Stripe.</Text>
      </VStack></StackItem>
      {portal.available !== false && <BillingPortalAction {...portal} label="Manage payments" />}
    </HStack>
    <HStack as="section" className="settings-row" aria-label="Invoices" align="start" justify="between" gap={4} wrap="wrap">
      <StackItem size="fill"><VStack gap={1}>
        <Heading level={3}>Invoices</Heading>
        <Text type="supporting" color="secondary">View available invoices and download PDFs in Stripe.</Text>
      </VStack></StackItem>
      {portal.available !== false && <BillingPortalAction {...portal} label="View invoices" />}
    </HStack>
    <VStack gap={2}>
      <Text type="supporting" color="secondary">Review available plan changes or cancellation in Stripe. Opening billing does not change your plan.</Text>
      {portal.available === false && <Text type="supporting" color="secondary">You do not have a Stripe billing account yet. Choose a plan or an available top-up to get started.</Text>}
      {noSubscription && <Text type="supporting" color="secondary">There is no active paid subscription to cancel.</Text>}
    </VStack>
  </VStack>
}
