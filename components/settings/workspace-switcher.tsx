'use client'

import { Building2, Check, ChevronsUpDown, Plus, UserRound } from 'lucide-react'
import type { BackendWorkspace } from '@/lib/backend/client'
import { roleLabels } from '@/lib/settings/organisations'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Which workspace the settings below belong to: the person, or one of their organisations.
 * Sits at the top of the settings navigation, as in Devin; the sections beneath follow the choice.
 */
export function WorkspaceSwitcher({ workspaces, current, onSelect, onCreate, disabled }: {
  workspaces: readonly BackendWorkspace[]
  current: BackendWorkspace | null
  onSelect: (workspace: BackendWorkspace) => void
  onCreate: () => void
  disabled?: boolean
}) {
  const personal = workspaces.filter((workspace) => workspace.kind === 'personal')
  const organisations = workspaces.filter((workspace) => workspace.kind === 'organisation')
  const Icon = current?.kind === 'organisation' ? Building2 : UserRound
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Switch workspace"
          className="flex w-full items-center gap-2.5 rounded-lg border border-border/70 bg-background px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"><Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{current?.name ?? 'Personal'}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{current?.kind === 'organisation' ? `Organisation · ${roleLabels[current.role]}` : 'Personal'}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {personal.map((workspace) => (
          <DropdownMenuItem key={workspace.id} onSelect={() => onSelect(workspace)}>
            <UserRound className="size-4" aria-hidden="true" />
            <span className="flex-1 truncate">{workspace.name}</span>
            {current?.id === workspace.id && <Check className="size-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
        {organisations.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Organisations</DropdownMenuLabel>
            {organisations.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onSelect={() => onSelect(workspace)}>
                <Building2 className="size-4" aria-hidden="true" />
                <span className="flex-1 truncate">{workspace.name}</span>
                <span className="text-[11px] text-muted-foreground">{roleLabels[workspace.role]}</span>
                {current?.id === workspace.id && <Check className="size-4" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Create organisation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
