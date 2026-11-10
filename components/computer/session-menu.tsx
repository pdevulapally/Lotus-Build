"use client"

import type { ReactNode } from "react"
import { CopyIcon, ExternalIcon, HistoryIcon, LiveSiteIcon, PreviewIcon, RenameIcon, SettingsIcon, UsageIcon } from "@/components/ui/lotus-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import { useAuth } from "@/contexts/auth-context"
import { GitHubGlyph } from "@/components/integrations/connector-icons"
import { cn } from "@/lib/utils"
import type { ComputerSessionResponse } from "@/components/computer/session-types"
import {
  Context, ContextCacheUsage, ContextContent, ContextContentBody, ContextContentFooter, ContextContentHeader,
  ContextInputUsage, ContextOutputUsage, ContextReasoningUsage, ContextTrigger, type ContextUsage,
} from "@/components/ai-elements/context"

export type SessionMenuProps = {
  session: ComputerSessionResponse
  projectFileCount: number | null
  remainingTokens: number | null
  planLabel: string
  liveSiteUrl?: string
  contextUsage?: { modelId?: string; maxTokens: number; usedTokens: number; usage: ContextUsage }
  onRename: () => void
  onRepository?: () => void
  onOpenHistory?: () => void
  dark: boolean
  align: "start" | "center"
}

const row = "h-9 gap-3 rounded-lg px-2.5 text-[13.5px] font-medium text-foreground focus:bg-muted/70 [&>svg:first-child]:size-4 [&>svg:first-child]:text-muted-foreground"

function ExternalRow({ href, icon, children }: { href?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenuItem asChild disabled={!href} className={row}>
      <a href={href || "#"} target="_blank" rel="noopener noreferrer">
        {icon}
        {children}
        <ExternalIcon className="ml-auto size-3.5 text-muted-foreground/70" />
      </a>
    </DropdownMenuItem>
  )
}

/** The session/account menu shared by the mobile and desktop title triggers. */
export function SessionMenuContent({
  session, projectFileCount, planLabel, liveSiteUrl, contextUsage, onRename, onRepository, onOpenHistory, dark, align,
}: SessionMenuProps) {
  const { userData } = useAuth()
  const { openSettings } = useSettingsDialog()
  const name = userData?.displayName || userData?.email?.split("@")[0] || "Account"
  const initials = name.split(/\s+/).map((part) => part[0]).join("").toUpperCase().slice(0, 2)

  return (
    <DropdownMenuContent
      align={align}
      sideOffset={8}
      className={cn(
        "w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/60 bg-popover p-1.5 text-popover-foreground shadow-[0_16px_48px_-16px_rgb(0_0_0/0.28)]",
        dark && "dark",
      )}
    >
      <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
        <Avatar className="size-9 shrink-0 rounded-full">
          <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-full object-cover" />
          <AvatarFallback className="rounded-full bg-muted text-[12px] font-semibold text-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-5 text-foreground">{name}</p>
          {userData?.email && <p className="truncate text-[12px] leading-4 text-muted-foreground">{userData.email}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{planLabel}</span>
      </div>

      <DropdownMenuItem onSelect={() => openSettings('usage')} className="mb-1 h-auto gap-3 rounded-xl bg-muted/55 px-2.5 py-2.5 focus:bg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <UsageIcon className="size-[18px] text-background" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-5 text-foreground">Usage</span>
          <span className="block text-[12px] leading-4 text-muted-foreground">
            View account and session usage
          </span>
        </span>
      </DropdownMenuItem>

      {contextUsage?.modelId && (
        <div className="mb-1 rounded-xl px-2.5 py-2">
          <Context maxTokens={contextUsage.maxTokens} modelId={contextUsage.modelId} usage={contextUsage.usage} usedTokens={contextUsage.usedTokens}>
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
              <ContextContentBody>
                <ContextInputUsage /><ContextOutputUsage /><ContextReasoningUsage /><ContextCacheUsage />
              </ContextContentBody>
              <ContextContentFooter />
            </ContextContent>
          </Context>
        </div>
      )}

      <div className="flex items-baseline justify-between px-2.5 pb-1 pt-2">
        <span className="text-[11.5px] font-semibold text-muted-foreground">This session</span>
        {projectFileCount !== null && (
          <span className="text-[11.5px] tabular-nums text-muted-foreground/80">{projectFileCount === 1 ? "1 file" : `${projectFileCount} files`}</span>
        )}
      </div>
      <DropdownMenuItem className={row} onSelect={onRename}><RenameIcon />Rename</DropdownMenuItem>
      {onRepository && (
        <DropdownMenuItem className={row} onSelect={onRepository} disabled={!session.projectId}><GitHubGlyph />Repository</DropdownMenuItem>
      )}
      {onOpenHistory && (
        <DropdownMenuItem className={row} onSelect={onOpenHistory} disabled={!session.projectId}><HistoryIcon />Version history</DropdownMenuItem>
      )}
      <ExternalRow href={session.previewUrl || undefined} icon={<PreviewIcon />}>Open preview</ExternalRow>
      <ExternalRow href={liveSiteUrl} icon={<LiveSiteIcon />}>Open live site</ExternalRow>
      <DropdownMenuItem className={row} onSelect={() => void navigator.clipboard?.writeText(session.id)}><CopyIcon />Copy session ID</DropdownMenuItem>

      <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/50" />
      <DropdownMenuItem className={row} onSelect={() => openSettings()}><SettingsIcon />Settings</DropdownMenuItem>
    </DropdownMenuContent>
  )
}
