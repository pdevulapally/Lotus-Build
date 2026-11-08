import type { ReactNode } from 'react'

/** A titled group of rows; the title is the only heading, the rows carry the rest. */
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="py-7 first:pt-0 last:pb-0">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-3 divide-y divide-border/70 border-y border-border/70">{children}</div>
    </section>
  )
}

/** One setting: what it is on the left, its value or control on the right. */
export function SettingsRow({ label, description, children }: { label: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children !== undefined && <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm sm:justify-end">{children}</div>}
    </div>
  )
}

export function SettingsBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tone === 'warning' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-muted text-foreground'}`}>
      {children}
    </span>
  )
}
