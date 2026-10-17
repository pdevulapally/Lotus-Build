export type ComputerSessionMode = 'build' | 'plan'
export const COMPUTER_SESSION_MODES = [
  { id: 'build', label: 'Build', description: 'Create and update your project.' },
  { id: 'plan', label: 'Plan', description: 'Work through the approach before building.' },
] as const
export function getComputerSessionModeConfig(value: ComputerSessionMode) {
  const config = COMPUTER_SESSION_MODES.find((item) => item.id === value)
  if (!config) throw new Error('Unsupported session mode. Choose Build or Plan.')
  return config
}
