import type { BackendAccount } from '@/lib/backend/client'

/** Do not infer saving from a plan name, or treat an unloaded account as disabled. */
export function WorkspacePersistenceNotice({ capabilities }: { capabilities?: BackendAccount['capabilities'] }) {
  const disabled = capabilities?.some((capability) =>
    capability.key === 'git.persistence' && capability.kind === 'boolean' && capability.value === false)
  if (!disabled) return null
  return <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground">
    File saving is currently disabled for this account. New files and changes won’t be kept after a run ends. Previously saved files remain available.
  </p>
}
