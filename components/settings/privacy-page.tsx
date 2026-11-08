import type { BackendAccount } from '@/lib/backend/client'
import { longDate } from '@/lib/settings/plans'
import { Button } from '@/components/ui/button'
import { CookiePreferencesButton } from '@/components/cookie-banner'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

export function PrivacyPage({ account, busy, onCloseAccount, onKeepAccount }: {
  account: BackendAccount
  busy: boolean
  onCloseAccount: () => void
  onKeepAccount: () => void
}) {
  const closing = account.closing ?? null
  return (
    <div>
      <SettingsSection title="Cookies">
        <SettingsRow label="Cookie preferences" description="Choose which optional cookies this site may use.">
          <CookiePreferencesButton className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Your account">
        {closing === null ? (
          <SettingsRow label="Close your account" description="Permanently deletes your projects, files and account details after a 30-day grace period. You will be asked to type your email to confirm.">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCloseAccount} className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive">Close account</Button>
          </SettingsRow>
        ) : closing.status === 'CLOSING' ? (
          <SettingsRow label={`Closing on ${longDate(closing.closesAt)}`} description="New builds and billing changes are paused. Keep your account to carry on as before; nothing is deleted until that date.">
            <Button type="button" size="sm" disabled={busy} onClick={onKeepAccount}>Keep my account</Button>
          </SettingsRow>
        ) : (
          <SettingsRow label="Account closing" description={closing.status === 'BLOCKED'
            ? 'Your grace period has ended and the final deletion is waiting on a check by our team. You will not be charged for anything further.'
            : 'Your account’s content has been deleted.'}>
            <SettingsBadge>{closing.status === 'BLOCKED' ? 'In review' : 'Deleted'}</SettingsBadge>
          </SettingsRow>
        )}
      </SettingsSection>
    </div>
  )
}
