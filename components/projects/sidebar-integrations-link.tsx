"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TeamAppIcon } from "@/components/ui/lotus-icons"
import { cn } from "@/lib/utils"

export function SidebarIntegrationsLink({ collapsed = false, onNavigate, className }: {
  collapsed?: boolean
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const active = pathname === "/integrations"

  return (
    <Link
      href="/integrations"
      onClick={onNavigate}
      title={collapsed ? "Integrations" : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        active && "bg-card font-medium",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      <TeamAppIcon className="size-4 shrink-0" />
      <span className={cn(collapsed && "sr-only")}>Integrations</span>
    </Link>
  )
}
