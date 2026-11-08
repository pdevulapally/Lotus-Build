import type { BackendAccount } from '@/lib/backend/client'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

const modeLabel: Record<string, string> = { auto: 'Auto', build: 'Build', plan: 'Plan' }
const effortLabel: Record<string, string> = { low: 'Low', standard: 'Standard', high: 'High', xhigh: 'Extra high' }

/** How LotusBuild works for this account, as the server states it. Values are set per project when it starts. */
export function PreferencesPage({ account }: { account: BackendAccount }) {
  return (
    <div>
      <SettingsSection title="Working style" description="Chosen when you start a project; these are the defaults your plan allows.">
        <SettingsRow label="Default mode" description="Auto lets LotusBuild decide when to ask, plan or build.">
          <SettingsBadge>{modeLabel[account.defaultSessionMode] ?? account.defaultSessionMode}</SettingsBadge>
        </SettingsRow>
        <SettingsRow label="Modes available">
          <span className="text-muted-foreground">{account.sessionModes.map((mode) => modeLabel[mode] ?? mode).join(' · ')}</span>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Models" description="What your plan can run. Effort is how long each step may think.">
        {account.models.length === 0 ? (
          <SettingsRow label="No models available" description="Your plan does not include an AI model right now." />
        ) : account.models.map((model) => (
          <SettingsRow key={model.id} label={model.name} description={model.efforts.length > 0 ? `Effort: ${model.efforts.map((effort) => effortLabel[effort] ?? effort).join(', ')}` : undefined}>
            <span className="tabular-nums text-muted-foreground">up to {model.maxOutputTokens.toLocaleString('en-GB')} tokens a reply</span>
          </SettingsRow>
        ))}
      </SettingsSection>
    </div>
  )
}
