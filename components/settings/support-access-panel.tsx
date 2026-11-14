import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { SupportAccessController } from '@/hooks/use-support-access'
import { SettingsGroup, SettingsRow } from './settings-primitives'

const eventCopy: Record<string, string> = {
  'code-issued': 'You generated a support code', 'code-cancelled': 'You cancelled the code', 'code-burned': 'The code was locked after too many wrong attempts',
  granted: 'Support access started', 'chat-viewed': 'Support opened one of your build chats', ended: 'Support access ended',
}

const when = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Support can read this customer's build chats only after they share a code
 * from here. The code is shown once; afterwards the panel shows only whether
 * access is active and what support did with it.
 */
export function SupportAccessPanel({ support }: { support: SupportAccessController }) {
  const { data, code, busy, error } = support
  const grant = data?.grant ?? null
  const pending = code ?? (data?.code ? { code: null, expiresAt: data.code.expiresAt } : null)
  return <SettingsGroup title="Support access">
    <SettingsRow label={grant ? 'Support can view your build chats' : 'Share a support code'}
      description={grant
        ? `Read-only access until ${when(grant.expiresAt)}. Support cannot change anything, and every chat they open is listed below.`
        : 'Only when you ask for help: generate a code and read it to the LotusBuild team. It lets them view your build chats, read-only, for 24 hours. You can end access at any time.'}>
      {grant
        ? <Button label="End access now" variant="destructive" isDisabled={busy} onClick={() => void support.endAccess()} />
        : <Button label={pending ? 'Generate a new code' : 'Generate support code'} isDisabled={busy} onClick={() => void support.generate()} />}
    </SettingsRow>
    {!grant && pending && <SettingsRow label={pending.code ? 'Your support code' : 'A code is waiting'}
      description={`Valid until ${when(pending.expiresAt)}, single use.${pending.code ? ' Read it to the team; it is not shown again after you leave this page.' : ''}`}>
      <HStack gap={2} align="center" wrap="wrap">
        {pending.code && <Text type="code" aria-label="Support code">{pending.code}</Text>}
        <Button label="Cancel code" variant="secondary" isDisabled={busy} onClick={() => void support.cancelCode()} />
      </HStack>
    </SettingsRow>}
    {error && <Text type="supporting" color="secondary" role="alert">{error}</Text>}
    {data && data.events.length > 0 && <SettingsRow label="History" description="Everything support did with your access, newest first.">
      <VStack gap={1} as="ul" aria-label="Support access history">
        {data.events.map((event) => <HStack key={event.id} as="li" gap={2} align="center" wrap="wrap">
          <Text type="supporting" color="secondary">{when(event.at)}</Text>
          <Text type="supporting">{eventCopy[event.kind] ?? event.kind}</Text>
          {event.by === 'support' && <Badge label="Support" />}
        </HStack>)}
      </VStack>
    </SettingsRow>}
  </SettingsGroup>
}
