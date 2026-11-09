'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import type { BackendOrganisation, BackendOrganisationBilling } from '@/lib/backend/client'
import { can, formatSeatPrice, formatSeatsTotal, minimumSeats } from '@/lib/settings/organisations'
import { longDate } from '@/lib/settings/plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsBadge, SettingsRow, SettingsSection } from '../settings-row'

export interface OrganisationPlanPageProps {
  organisation: BackendOrganisation
  billing: BackendOrganisationBilling | null
  busy: boolean
  onCheckout: (planKey: string, seats: number) => void
  onChangeSeats: (seats: number) => void
  onManageBilling: () => void
  onReconcile: () => void
}

/** The Teams plan for this organisation: buy it with a seat count, resize it, or open invoices. Owner only for changes. */
export function OrganisationPlanPage({ organisation, billing, busy, onCheckout, onChangeSeats, onManageBilling, onReconcile }: OrganisationPlanPageProps) {
  const manage = can(organisation.role, 'manageBilling')
  const plan = billing?.plans[0] ?? null
  const minimum = plan ? minimumSeats(plan.minSeats, billing?.memberCount ?? organisation.memberCount) : 1
  const [seats, setSeats] = useState<number | null>(null)
  if (billing === null) return <p className="py-3 text-sm text-muted-foreground">Loading plan…</p>
  const live = billing.subscription
  const chosen = seats ?? (live ? live.seats : minimum)
  const invalid = chosen < minimum
  return (
    <div>
      <SettingsSection title="Plan">
        {live === null ? (
          <SettingsRow label="No plan yet" description="Members can’t build in this organisation until it has a plan.">
            <SettingsBadge tone="warning">Plan required</SettingsBadge>
          </SettingsRow>
        ) : (
          <SettingsRow label={live.planName} description={live.cancelAtPeriodEnd ? `Ends on ${longDate(live.currentPeriodEnd)}.` : `${live.seats} ${live.seats === 1 ? 'seat' : 'seats'} · renews on ${longDate(live.currentPeriodEnd)}.`}>
            <SettingsBadge>{live.status.toLowerCase().replace(/_/g, ' ')}</SettingsBadge>
            {manage && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onManageBilling}><CreditCard aria-hidden="true" />Invoices &amp; payment</Button>}
          </SettingsRow>
        )}
        {manage && (
          <SettingsRow label="Pending change" description="If a seat change or payment was started elsewhere and never finished, check and finish it here.">
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onReconcile}>Finish pending change</Button>
          </SettingsRow>
        )}
      </SettingsSection>

      {plan && manage && (
        <SettingsSection title={live === null ? `Choose ${plan.name}` : 'Seats'}
          description={plan.price ? `${formatSeatPrice(plan.price)} · ${plan.minSeats} seats minimum. Each seat adds a full allowance to the pool everyone in the organisation shares.` : undefined}>
          <SettingsRow label="Seats" description={billing.memberCount > plan.minSeats ? `At least ${minimum}: one for each of the ${billing.memberCount} members.` : `At least ${plan.minSeats}.`}>
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (!invalid && !busy) (live === null ? onCheckout(plan.key, chosen) : onChangeSeats(chosen)) }}>
              <Input type="number" min={minimum} max={500} value={chosen} onChange={(event) => setSeats(Number(event.target.value))} className="h-8 w-24 text-sm tabular-nums" aria-label="Seats" aria-invalid={invalid} />
              <Button type="submit" size="sm" disabled={busy || invalid || (live !== null && chosen === live.seats)}>
                {live === null ? 'Continue to payment' : chosen > live.seats ? 'Add seats' : 'Remove seats'}
              </Button>
            </form>
          </SettingsRow>
          {plan.price && !invalid && (
            <SettingsRow label="Total" description={live !== null && chosen !== live.seats ? 'Stripe charges or credits the difference for the rest of this period.' : undefined}>
              <span className="tabular-nums">{formatSeatsTotal(plan.price, chosen)}</span>
            </SettingsRow>
          )}
        </SettingsSection>
      )}
      {!manage && <p className="py-3 text-[13px] text-muted-foreground">Only the owner can buy the plan or change seats.</p>}
    </div>
  )
}
