import type { BackendAccount } from '@/lib/backend/client'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { EmailCodeVerification } from '@/components/auth/email-code-verification'
import { openCookiePreferences } from '@/lib/privacy/cookie-consent'
import { ProfileAvatar } from '@/components/ui/profile-avatar'
import { SettingsGroup, SettingsRow } from './settings-primitives'

export function AccountPanel({ account, email, displayName, photoURL, busy, onVerified, onErasure }: {
  account: BackendAccount
  email: string
  displayName?: string | null
  photoURL?: string | null
  busy: boolean
  onVerified: () => void
  onErasure: () => void
}) {
  const name = displayName?.trim() || account.displayName?.trim()
  return <VStack as="section" aria-label="Account details" gap={4}>
    <HStack align="center" gap={3}>
      <ProfileAvatar name={name} email={email} photoURL={photoURL} />
      <VStack gap={0.5}>
        <Heading level={3}>{name || 'Your account'}</Heading>
        <Text type="supporting" color="secondary" wordBreak="break-all">{account.email}</Text>
      </VStack>
    </HStack>
    <SettingsGroup title="Profile">
      <SettingsRow label="Email verification"><Badge label={account.emailVerified ? 'Verified' : 'Not verified'} /></SettingsRow>
      <SettingsRow label="Projects"><Text type="body" color="secondary">{account.projectCount.toLocaleString()}</Text></SettingsRow>
      {!account.emailVerified && <EmailCodeVerification appearance="astryx" email={email} autoSend={false} onVerified={onVerified} />}
    </SettingsGroup>
    <SettingsGroup title="Privacy">
      <SettingsRow label="Cookie preferences" description="Choose how optional cookies are used.">
        <Button label="Cookie preferences" aria-haspopup="dialog" onClick={openCookiePreferences} />
      </SettingsRow>
      <SettingsRow label="Account erasure" description="Requests are reviewed before deletion. Submitting a request does not delete your account.">
        <Button label="Request account erasure" variant="destructive" isDisabled={busy} onClick={onErasure} />
      </SettingsRow>
    </SettingsGroup>
  </VStack>
}
