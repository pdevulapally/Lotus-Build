'use client'

import Link from 'next/link'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { HStack } from '@astryxdesign/core/HStack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { CreditsController } from '@/hooks/use-credits'

export function CreditBalance({ credits, showAction = true, onBuy }: { credits: CreditsController; showAction?: boolean; onBuy?: () => void }) {
  const { data, loading, unavailable, error } = credits
  const action = data?.purchasing.enabled && data.offers.length > 0 ? 'Buy credits' : 'View credit options'
  return <Card variant="muted" padding={4} aria-label="Credit balance" aria-busy={loading}>
    <VStack gap={3}>
      <HStack align="center" justify="between" gap={3} wrap="wrap">
        <Heading level={4}>Available credits</Heading>
        {showAction && (onBuy ? <Button label={action} onClick={onBuy} /> : <Button label={action} as={Link} href="/account/billing#on-demand" />)}
      </HStack>
      {loading ? <Text type="body" color="secondary" role="status">Loading credit balance…</Text> : data?.wallet ? <>
        <HStack align="center" gap={2}><Heading level={2}>{data.wallet.availableCredits.toLocaleString('en-GB')}</Heading><Text type="supporting" color="secondary">credits</Text></HStack>
        <Text type="supporting" color="secondary">{data.wallet.reservedCredits.toLocaleString('en-GB')} reserved for work in progress</Text>
      </> : <Text type="body" color="secondary">{unavailable ? 'On-demand usage is not available yet.' : error ? 'Credit balance could not be loaded. View credit options to try again.' : 'Credit balance is unavailable.'}</Text>}
      <Text type="supporting" color="secondary">Extra credits cover AI usage after your plan allowance. Your subscription stays the same.</Text>
    </VStack>
  </Card>
}
