'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { Connection, Connector, PluginTool } from '@/lib/backend/connections'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { HStack } from '@astryxdesign/core/HStack'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { SettingsGroup, SettingsRow } from './settings-primitives'

const permissionOptions = [
  { value: 'off', label: 'Disabled' },
  { value: 'read-only', label: 'Read-only' },
  { value: 'always', label: 'Enabled' },
] as const

/** Only reviewed tool identities are submitted. A server hint never enables a tool automatically. */
export function PluginPermissions({ tools, disabled, onChange, remote = true }: { tools: PluginTool[]; disabled: boolean; onChange: (tools: PluginTool[]) => void; remote?: boolean }) {
  return <VStack gap={3}>
    <Text type="supporting" color="secondary">Choose what the agent may use within your requests. {remote ? 'Read-only limits the tools available here; use credentials restricted by the provider for strict read-only access. A server can mislabel its tools.' : 'Publishing still requires your approval of each prepared build.'}</Text>
    <HStack gap={2} wrap="wrap">
      <Button label="Disable all" isDisabled={disabled} onClick={() => onChange(tools.map(tool => ({ ...tool, mode: 'off' })))} />
      <Button label="Read-only tools" isDisabled={disabled} onClick={() => onChange(tools.map(tool => ({ ...tool, mode: tool.readOnly ? 'read-only' : 'off' })))} />
    </HStack>
    {tools.length === 0 && <Text type="body" color="secondary">This plugin has no tools to review.</Text>}
    {tools.map(tool => <SettingsRow key={tool.name} label={tool.name} description={tool.description}>
      <SegmentedControl label={`Access for ${tool.name}`} value={tool.mode} isDisabled={disabled}
        onChange={value => {
          const mode = permissionOptions.find(option => option.value === value)?.value
          if (mode) onChange(tools.map(item => item.name === tool.name ? { ...item, mode } : item))
        }}>
        {permissionOptions.map(option => <SegmentedControlItem key={option.value} {...option} isDisabled={option.value === 'read-only' && !tool.readOnly} />)}
      </SegmentedControl>
    </SettingsRow>)}
  </VStack>
}

export function PluginsPanel({ section = 'mcp' }: { section?: 'mcp' | 'integrations' }) {
  const [data, setData] = useState<{ connectors: Connector[]; connections: Connection[]; projects: { id: string; name: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Connection | null>(null)
  const [tools, setTools] = useState<PluginTool[] | null>(null)
  const [grants, setGrants] = useState<string[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [connector, setConnector] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    const controller = new AbortController(); const version = ++generation.current
    const backend = currentBackend()
    Promise.all([backend.connectionCatalogue(controller.signal), backend.connections(controller.signal), backend.projects(controller.signal)])
      .then(([catalogue, connections, projects]) => {
        if (controller.signal.aborted || generation.current !== version) return
        setData({ connectors: catalogue.connectors, connections: connections.connections, projects: projects.projects })
      }).catch(reason => { if (!controller.signal.aborted && generation.current === version) setError(reason instanceof Error ? reason.message : 'Plugins could not be loaded.') })
    return () => { controller.abort(); generation.current++ }
  }, [])

  const perform = async (action: (current: () => boolean) => Promise<void>) => {
    const version = generation.current
    const current = () => generation.current === version
    setBusy(true); setError(null); setNotice(null)
    try { await action(current) } catch (reason) { if (current()) setError(reason instanceof Error ? reason.message : 'The change could not be confirmed. Refresh before trying it again.') }
    finally { if (current()) setBusy(false) }
  }
  const manage = (connection: Connection) => void perform(async current => {
    const backend = currentBackend()
    const [result, detail] = await Promise.all([backend.pluginTools(connection.id), backend.connection(connection.id)])
    if (detail.connection.grantedProjectIds === undefined) throw new Error('Project access could not be loaded. Refresh before editing this connection.')
    if (current()) { setSelected(detail.connection); setTools(result.tools); setGrants(detail.connection.grantedProjectIds) }
  })
  const connect = (event: FormEvent<HTMLElement>) => {
    event.preventDefault()
    if (!connector) { setError('Choose a service.'); return }
    if (!URL.canParse(url)) { setError('Enter a valid server address.'); return }
    void perform(async current => {
      const result = await currentBackend().connectPlugin({ connector, name, url, ...(token === '' ? {} : { token }), projectIds: [] })
      if (!current()) return
      setToken(''); setUrl(''); setName(''); setSelected(result.connection); setTools(result.tools); setGrants([])
      setData(previous => previous && ({ ...previous, connections: [...previous.connections, result.connection] }))
      setNotice('Connected. Review tools and project access before enabling anything.')
      if (result.rejected?.length) setNotice(`Connected. ${result.rejected.length} tool definitions were rejected; review the server before enabling tools.`)
    })
  }
  if (!data) return <Text type="body" color="secondary" role={error ? 'alert' : 'status'}>{error ?? 'Loading plugins...'}</Text>
  const remote = data.connectors.filter(item => item.auth === 'mcp-remote')
  const remoteKeys = new Set(remote.map(item => item.key))
  const managedKeys = section === 'mcp' ? remoteKeys : new Set(data.connectors.filter(item => item.toolPermissions === true && item.auth !== 'mcp-remote').map(item => item.key))
  const connections = data.connections.filter(item => managedKeys.has(item.connector) && item.status === 'active')
  return <VStack gap={4}>
    {error && <Text type="body" role="alert" className="text-destructive">{error}</Text>}
    {notice && <Text type="body" role="status" color="secondary">{notice}</Text>}
    <SettingsGroup title={section === 'mcp' ? 'Connected plugins' : 'Integration access'}>
      {connections.length === 0 && <Text type="body" color="secondary">{section === 'mcp' ? 'No plugins connected.' : 'Connect an integration to choose its tools and project access.'}</Text>}
      {connections.map(connection => <SettingsRow key={connection.id} label={connection.account?.name ?? connection.id}>
        <Button label="Manage" variant={selected?.id === connection.id ? 'primary' : 'secondary'} isDisabled={busy} onClick={() => manage(connection)} />
      </SettingsRow>)}
    </SettingsGroup>
    {selected && tools && <VStack gap={4} as="section" aria-label={`Settings for ${selected.account?.name ?? selected.id}`}>
      <SettingsGroup title={selected.account?.name ?? selected.id}>
        {section === 'mcp' && <SettingsRow label="Available tools">
          <Button label="Refresh tools" isDisabled={busy} onClick={() => void perform(async current => {
            const result = await currentBackend().refreshPluginTools(selected.id)
            if (current()) { setTools(result.tools); setNotice(`Tools refreshed. Changed and new tools are disabled.${result.rejected?.length ? ` ${result.rejected.length} definitions were rejected.` : ''}`) }
          })} />
        </SettingsRow>}
        <PluginPermissions tools={tools} disabled={busy} onChange={setTools} remote={section === 'mcp'} />
        <Button label="Save permissions" variant="primary" isDisabled={busy} onClick={() => void perform(async current => {
          const result = await currentBackend().setPluginPermissions(selected.id, tools)
          if (current()) { setTools(result.tools); setNotice('Tool permissions saved. Future calls check these settings.') }
        })} />
      </SettingsGroup>
      <SettingsGroup title="Project access">
        <Text type="supporting" color="secondary">Only selected projects may use this plugin.</Text>
        {data.projects.map(project => <CheckboxInput key={project.id} label={project.name} isDisabled={busy} value={grants.includes(project.id)}
          onChange={checked => setGrants(previous => checked ? [...previous, project.id] : previous.filter(id => id !== project.id))} />)}
        <Button label="Save project access" isDisabled={busy} onClick={() => void perform(async current => {
          const result = await currentBackend().setConnectionGrants(selected.id, grants)
          if (current()) { setSelected(result.connection); setData(previous => previous && ({ ...previous, connections: previous.connections.map(item => item.id === result.connection.id ? result.connection : item) })); setNotice('Project access saved.') }
        })} />
      </SettingsGroup>
      <Button label="Disconnect plugin" variant="destructive" isDisabled={busy} onClick={() => void perform(async current => {
        const result = await currentBackend().disconnectConnection(selected.id)
        if (current()) { setSelected(null); setTools(null); setData(previous => previous && ({ ...previous, connections: previous.connections.filter(item => item.id !== result.connection.id) })); setNotice('Disconnected in LotusBuild. Revoke its credential at the provider too.') }
      })} />
    </VStack>}
    {section === 'mcp' && <VStack as="form" onSubmit={connect} gap={3}>
      <SettingsGroup title="Connect a plugin">
        {remote.filter(item => item.status === 'available').length === 0 ? <Text type="body" color="secondary">Plugin connections are not configured on this server.</Text> : <VStack gap={3}>
          <Selector label="Service" isRequired value={connector} isDisabled={busy} onChange={setConnector} placeholder="Choose a service" width="100%"
            options={remote.filter(item => item.status === 'available').map(item => ({ value: item.key, label: item.name }))} />
          <TextInput label="Name" isRequired value={name} isDisabled={busy} onChange={setName} width="100%" {...{ maxLength: 60 }} />
          <TextInput label="Server address" isRequired value={url} isDisabled={busy} onChange={setUrl} width="100%" {...{ maxLength: 2048, inputMode: 'url' }} />
          <TextInput label="Access token, if required" type="password" autoComplete="off" value={token} isDisabled={busy} onChange={setToken} width="100%" {...{ maxLength: 4096, spellCheck: false }} />
          <Text type="supporting" color="secondary">Credentials stay on the server. New tools start disabled and no project is granted access automatically.</Text>
          <Button label="Connect" type="submit" variant="primary" isDisabled={busy} />
        </VStack>}
      </SettingsGroup>
    </VStack>}
  </VStack>
}
