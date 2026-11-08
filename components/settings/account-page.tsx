import type { ReactNode } from 'react'
import type { BackendAccount } from '@/lib/backend/client'
import { Button } from '@/components/ui/button'
import { CookiePreferencesButton } from '@/components/cookie-banner'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

export function AccountPage({ account, verification, busy, onRequestErasure }: {
  account: BackendAccount
  /** The verification control, only when the address is not yet verified. */
  verification?: ReactNode
  busy: boolean
  onRequestErasure: () => void
}) {
  const name = account.displayName || 'Your account'
  return (
    <div>
      <SettingsSection title="Profile">
        <SettingsRow label="Name">
          <span className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
            <span className="font-medium">{name}</span>
          </span>
        </SettingsRow>
        <SettingsRow label="Email" description={account.emailVerified ? undefined : 'Verify your address to keep your account secure.'}>
          <span className="break-all">{account.email}</span>
          <SettingsBadge tone={account.emailVerified ? 'neutral' : 'warning'}>{account.emailVerified ? 'Verified' : 'Not verified'}</SettingsBadge>
        </SettingsRow>
        {verification && <div className="py-4">{verification}</div>}
        <SettingsRow label="Projects" description="Projects in this workspace.">
          <span className="font-medium tabular-nums">{account.projectCount.toLocaleString('en-GB')}</span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Privacy and data">
        <SettingsRow label="Cookie preferences" description="Choose which optional cookies this site may use.">
          <CookiePreferencesButton className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" />
        </SettingsRow>
        <SettingsRow label="Delete your account" description="Erasure requests are reviewed before anything is deleted. Submitting one does not delete your account straight away.">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRequestErasure}>Request erasure</Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
