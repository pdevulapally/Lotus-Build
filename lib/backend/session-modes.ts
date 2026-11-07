import { z } from 'zod'

export const computerSessionModes = ['build', 'plan', 'auto'] as const
export const computerSessionModeSchema = z.enum(computerSessionModes)
export type ComputerSessionMode = z.infer<typeof computerSessionModeSchema>
export const COMPUTER_SESSION_MODES = [
  { id: 'auto', label: 'Auto', description: 'Let LotusBuild decide whether to answer, clarify, plan, or build.' },
  { id: 'build', label: 'Build', description: 'Create and update your project.' },
  { id: 'plan', label: 'Plan', description: 'Work through the approach before building.' },
] as const
export function getComputerSessionModeConfig(value: ComputerSessionMode) {
  const config = COMPUTER_SESSION_MODES.find((item) => item.id === value)
  if (!config) throw new Error('Unsupported session mode. Choose Auto, Build or Plan.')
  return config
}

/** Only modes both this client and the server know enter the picker. */
export function selectableSessionModeConfigs(advertised: readonly string[] | undefined) {
  const available = new Set(advertised ?? ['build', 'plan'])
  return COMPUTER_SESSION_MODES.filter((mode) => available.has(mode.id))
}

export function defaultComputerSessionMode(advertised: readonly string[] | undefined, serverDefault: string | undefined): ComputerSessionMode {
  const selectable = selectableSessionModeConfigs(advertised)
  const configured = computerSessionModeSchema.safeParse(serverDefault)
  if (configured.success && selectable.some((mode) => mode.id === configured.data)) return configured.data
  return selectable[0]?.id ?? 'build'
}
