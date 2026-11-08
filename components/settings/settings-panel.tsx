import type { ReactNode } from 'react'
import { CreditCard, Gauge, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import type { BackendAccount, BackendUsage } from '@/lib/backend/client'
import { Button } from '@/components/ui/button'
import { AccountPage } from './account-page'
import { PlanPage } from './plan-page'
import { UsagePage } from './usage-page'

export type SettingsPage = 'account' | 'usage' | 'plan'

interface PageDefinition { readonly label: string; readonly description: string; readonly icon: LucideIcon }
interface NavGroup { readonly label: string; readonly pages: readonly SettingsPage[] }

export const SETTINGS_PAGES: Readonly<Record<SettingsPage, PageDefinition>> = {
  account: { label: 'Account', description: 'Your profile, privacy and data.', icon: UserRound },
  usage: { label: 'Usage', description: 'What you have used this period, and when it resets.', icon: Gauge },
  plan: { label: 'Plan & billing', description: 'Your plan, what it includes, and billing.', icon: CreditCard },
}

export const SETTINGS_NAV: readonly NavGroup[] = [
  { label: 'Account', pages: ['account'] },
  { label: 'Workspace', pages: ['usage', 'plan'] },
]

export interface SettingsPanelProps {
  readonly page: SettingsPage
  readonly onPageChange: (page: SettingsPage) => void
  readonly account: BackendAccount | null
  readonly usage: BackendUsage | null
  readonly busy: boolean
  readonly message: string | null
  readonly error: string | null
  readonly verification?: ReactNode
  readonly onRefresh: () => void
  readonly onManageBilling: () => void
  readonly onComparePlans: () => void
  readonly onRequestErasure: () => void
  /** The dialog title element, so the accessible name belongs to the dialog that owns the panel. */
  readonly title: ReactNode
  readonly description: (text: string) => ReactNode
}

/** The settings surface itself: a grouped side nav and one page, with no knowledge of auth or the backend. */
export function SettingsPanel(props: SettingsPanelProps) {
  const { page, onPageChange, account, usage, busy, message, error } = props
  const active = SETTINGS_PAGES[page]
  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border/70 bg-muted/40 sm:w-56 sm:border-b-0 sm:border-r">
        <div className="px-5 pb-3 pt-5 pr-14 sm:px-5 sm:pb-4 sm:pt-6">{props.title}</div>
        <nav className="flex gap-4 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:flex-col sm:gap-5 sm:overflow-x-visible sm:px-3 sm:pb-5" aria-label="Settings sections">
          {SETTINGS_NAV.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-1 sm:flex-col">
              <p className="hidden px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:block">{group.label}</p>
              {group.pages.map((item) => {
                const { icon: Icon, label } = SETTINGS_PAGES[item]
                const current = page === item
                return (
                  <button
                    key={item}
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => onPageChange(item)}
                    className={`flex min-h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      current ? 'bg-background text-foreground shadow-[inset_0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-9 sm:py-8" aria-busy={busy}>
        <header className="mb-6 sm:pr-8">
          <h2 className="text-lg font-semibold tracking-tight">{active.label}</h2>
          {props.description(active.description)}
        </header>

        {error && <p role="alert" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">{message}</p>}

        {account === null ? (
          <div>
            <h3 className="text-sm font-semibold">Account details unavailable</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your account details could not be loaded. Reconnect to try again.</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" disabled={busy} onClick={props.onRefresh}><RefreshCw aria-hidden="true" />Try again</Button>
          </div>
        ) : page === 'account' ? (
          <AccountPage account={account} verification={props.verification} busy={busy} onRequestErasure={props.onRequestErasure} />
        ) : page === 'usage' ? (
          <UsagePage usage={usage} busy={busy} onRefresh={props.onRefresh} />
        ) : (
          <PlanPage account={account} usage={usage} busy={busy} onManageBilling={props.onManageBilling} onComparePlans={props.onComparePlans} />
        )}
      </main>
    </div>
  )
}
