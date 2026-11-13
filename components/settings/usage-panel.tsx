'use client'

import { useId, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { HStack } from '@astryxdesign/core/HStack'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { BackendSessionUsage, BackendUsage } from '@/lib/backend/client'
import { quantityWithUnit } from '@/lib/plans/format'
import { groupUsageMeters, meterProgress, planMeterUsage, remainingAllowance, usageMeterLabel, usageReset, type UsageMeter as Meter } from '@/lib/settings/usage'
import { SettingsGroup, SettingsRow } from './settings-primitives'

export function UsageMeter({ meter }: { meter: Meter }) {
  const descriptionId = useId()
  const { limit, percent, atLimit } = meterProgress(meter)
  const plan = planMeterUsage(meter)
  const label = usageMeterLabel(meter)
  return <VStack as="section" gap={2} aria-label={label}>
    <SettingsRow label={label}><Text type="label" className={atLimit ? 'text-warning-soft-foreground' : undefined}>{remainingAllowance(meter)}</Text></SettingsRow>
    {percent !== null && limit !== null && limit > 0 && <ProgressBar label={`${label} including reservations`} isLabelHidden
      value={Math.min(plan.totalUsed, limit)} max={limit} variant={atLimit ? 'warning' : 'neutral'} aria-describedby={descriptionId}
      formatValueLabel={() => `${quantityWithUnit(meter.unit, plan.totalUsed)} of ${quantityWithUnit(meter.unit, limit)}, including ${quantityWithUnit(meter.unit, plan.reserved)} reserved`} />}
    <Text type="supporting" color="secondary" id={descriptionId}>{usageReset(meter)}</Text>
  </VStack>
}

function UsageMeterDetails({ meter }: { meter: Meter }) {
  const { limit } = meterProgress(meter)
  const plan = planMeterUsage(meter)
  const hasPaidUsage = meter.prepaidConsumed !== undefined || meter.prepaidReserved !== undefined
  const label = usageMeterLabel(meter)
  return <VStack as="section" gap={3} aria-label={`${label} details`}>
    <Text type="label">{label}</Text>
    <SettingsRow label={hasPaidUsage ? 'Plan used' : 'Used'}><Text type="body">{quantityWithUnit(meter.unit, plan.consumed)}</Text></SettingsRow>
    <SettingsRow label={hasPaidUsage ? 'Plan reserved' : 'Reserved'}><Text type="body">{quantityWithUnit(meter.unit, plan.reserved)}</Text></SettingsRow>
    <SettingsRow label="Limit"><Text type="body">{limit === null ? 'Unlimited' : quantityWithUnit(meter.unit, limit)}</Text></SettingsRow>
    {limit !== null && <SettingsRow label="Remaining"><Text type="body">{quantityWithUnit(meter.unit, Math.max(0, limit - plan.totalUsed))}</Text></SettingsRow>}
    {hasPaidUsage && <>
      <SettingsRow label="Paid credits used"><Text type="body">{quantityWithUnit(meter.unit, meter.prepaidConsumed ?? 0)}</Text></SettingsRow>
      <SettingsRow label="Paid credits reserved"><Text type="body">{quantityWithUnit(meter.unit, meter.prepaidReserved ?? 0)}</Text></SettingsRow>
    </>}
  </VStack>
}

export function AccountUsage({ usage, onManagePlan, showManagePlan = true, onDemand }: { usage: BackendUsage | null; onManagePlan?: () => void; showManagePlan?: boolean; onDemand?: ReactNode }) {
  if (!usage) return <VStack gap={4}><Text type="body" color="secondary">Usage is unavailable. Refresh to try again.</Text>{onDemand}</VStack>
  if (usage.meters.length === 0) return <VStack gap={4}><Text type="body" color="secondary">No usage has been reported for your account yet.</Text>{onDemand}</VStack>
  const groups = groupUsageMeters(usage.meters)
  const primary = groups.find(group => group.key === 'ai')
  const other = groups.filter(group => group.key === 'workspace' || group.key === 'other')
  const details = groups.filter(group => group.key === 'tokens' || group.key === 'fallback')
  const shared = usage.meters.some(meter => meter.role === 'ai.allowance')
  return <VStack as="section" gap={4} aria-label="Account usage">
    <HStack align="center" justify="between" gap={3} wrap="wrap">
      <VStack gap={1}>
        <Heading level={3}>{usage.plan.name} plan allowance</Heading>
        <Text type="supporting" color="secondary">{shared ? 'One AI allowance across models, voice and projects.' : 'Shared across your projects.'}</Text>
      </VStack>
      {showManagePlan && (onManagePlan ? <Button label="Manage plan" onClick={onManagePlan} /> : <Button label="Manage plan" as={Link} href="/account/billing" />)}
    </HStack>
    {primary ? <SettingsGroup title="AI allowance">
      {primary.meters.map(meter => <UsageMeter key={meter.meterKey} meter={meter} />)}
      <Text type="supporting" color="secondary">{shared ? 'Work in progress counts towards usage. Daily or weekly limits, when shown, apply to the same allowance.' : 'Work in progress counts towards your usage.'}</Text>
    </SettingsGroup> : <Text type="body" color="secondary">An AI allowance summary is not available for this account. View reported usage below.</Text>}
    {onDemand}
    {other.length > 0 && <VStack as="section" gap={3} aria-label="Workspace and other usage">
      {other.map(group => <SettingsGroup key={group.key} title={group.key === 'other' ? 'Additional allowances' : group.title}>
        {group.meters.map(meter => <UsageMeter key={meter.meterKey} meter={meter} />)}
      </SettingsGroup>)}
    </VStack>}
    <Collapsible trigger={<Text type="supporting" color="secondary">Usage details</Text>} defaultIsOpen={false}>
      <VStack gap={4} paddingBlock={3}>
        <Text type="supporting" color="secondary">Reserved usage is set aside for work in progress. The final amount may change when it finishes.</Text>
        {[...(primary?.meters ?? []), ...other.flatMap(group => group.meters)].map(meter => <UsageMeterDetails key={meter.meterKey} meter={meter} />)}
        {details.map(group => <VStack as="section" key={group.key} gap={2} aria-label={group.title}>
          <Heading level={4}>{group.title}</Heading>
          <Text type="supporting" color="secondary">{group.description}</Text>
          {group.meters.map(meter => <SettingsRow key={meter.meterKey} label={meter.label}>
            <VStack gap={0.5}>
              <Text type="body">{quantityWithUnit(meter.unit, meter.consumed)} used</Text>
              {meter.reserved > 0 && <Text type="supporting" color="secondary">{quantityWithUnit(meter.unit, meter.reserved)} in progress</Text>}
            </VStack>
          </SettingsRow>)}
        </VStack>)}
      </VStack>
    </Collapsible>
  </VStack>
}

export function SessionUsage({ usage, error, loading }: { usage: BackendSessionUsage | null; error: string | null; loading: boolean }) {
  if (error) return <Text type="body" role="alert" className="text-destructive">Session usage could not be loaded. Refresh to try again.</Text>
  if (!usage) return <Text type="body" color="secondary" role="status">{loading ? 'Loading session usage…' : 'Session usage is unavailable. Refresh to try again.'}</Text>
  return <VStack as="section" gap={3} aria-label="Session usage">
    <Text type="supporting" color="secondary">Usage for this session across its runs, including earlier billing periods. Account allowances apply across all projects.</Text>
    {usage.meters.length === 0 ? <Text type="body" color="secondary">No usage has been reported for this session yet.</Text> :
      usage.meters.map(meter => <SettingsRow key={meter.meterKey} label={meter.label}>
        <VStack gap={0.5}><Text type="body">{quantityWithUnit(meter.unit, meter.settled)} used</Text><Text type="supporting" color="secondary">{quantityWithUnit(meter.unit, meter.open)} reserved</Text></VStack>
      </SettingsRow>)}
  </VStack>
}
