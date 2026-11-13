import { Children, type ReactNode } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { HStack } from '@astryxdesign/core/HStack'
import { StackItem } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

/** The template's subject groups and responsive rows, shared by every panel. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <VStack as="section" aria-label={title} gap={2}>
    <Heading level={4}>{title}</Heading>
    <Card variant="muted" padding={4}>
      <VStack gap={3}>{Children.toArray(children).map((child, index) => <VStack key={index} gap={3}>
        {index > 0 && <Divider />}{child}
      </VStack>)}</VStack>
    </Card>
  </VStack>
}

export function SettingsRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return <HStack className="settings-row" gap={3} align="center" justify="between" wrap="wrap">
    <StackItem size="fill"><VStack gap={0.5}>
      <Text type="label">{label}</Text>
      {description && <Text type="supporting" color="secondary">{description}</Text>}
    </VStack></StackItem>
    {children}
  </HStack>
}
