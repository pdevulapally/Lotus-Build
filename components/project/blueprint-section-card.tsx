"use client"

import type { BlueprintSection } from "@/lib/projects/types"
import { BlueprintStatusBadge } from "@/components/project/blueprint-status-badge"

export function BlueprintSectionCard({ section }: { section: BlueprintSection }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-[-0.03em] text-foreground">{section.title}</h3>
        {section.description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        {section.items.map((item) => (
          <div key={item.key} className="border-l border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground">{item.value}</p>
              </div>
              <BlueprintStatusBadge status={item.status} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
