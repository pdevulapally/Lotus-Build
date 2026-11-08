import { Button } from '@/components/ui/button'
import { CookiePreferencesButton } from '@/components/cookie-banner'
import { SettingsRow, SettingsSection } from './settings-row'

export function PrivacyPage({ busy, onRequestErasure }: { busy: boolean; onRequestErasure: () => void }) {
  return (
    <div>
      <SettingsSection title="Cookies">
        <SettingsRow label="Cookie preferences" description="Choose which optional cookies this site may use.">
          <CookiePreferencesButton className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Your data">
        <SettingsRow label="Delete your account" description="Erasure requests are reviewed before anything is deleted. Submitting one does not delete your account straight away.">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRequestErasure}>Request erasure</Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
