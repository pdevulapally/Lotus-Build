import type { Connector } from '../backend/connections'

type ConnectionInformation = {
  key: string
  title: string
  description: string
  capabilities?: Connector['capabilities']
  link?: { href: string; label: string }
}

/** Product explanations, without claiming provider authorship, admin consent or training policies. */
export function connectionInformation(connector: Connector): ConnectionInformation[] {
  return [
    {
      key: 'permissions', title: 'You control access',
      description: connector.toolPermissions
        ? 'Choose which projects and tools may use this integration in Integration access. Connecting alone does not enable its tools.'
        : `Review the access requested by ${connector.name} before continuing. You can disconnect it from LotusBuild and manage access in the service’s own settings.`,
      capabilities: connector.capabilities,
    },
    {
      key: 'data', title: 'How your data is used',
      description: `The features you enable may share relevant project information with ${connector.name}. Review our privacy policy and the service’s terms before connecting.`,
      link: { href: '/privacy#connections', label: 'Learn more' },
    },
    {
      key: 'risk', title: 'Connect services you trust',
      description: 'Connected services and their content can introduce risk. Grant only the access you need, and review external actions before approving them.',
      link: { href: '/privacy#ai-processing', label: 'About connected-service risks' },
    },
  ]
}
