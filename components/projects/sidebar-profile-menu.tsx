"use client"

import { useRouter } from "next/navigation"
import { BillingIcon, ChevronUpDownIcon, SettingsIcon, SignOutIcon } from "@/components/ui/lotus-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import { cn } from "@/lib/utils"

const menuItemClass = "min-h-11 gap-3 rounded-xl px-3 text-[13px] font-medium focus:bg-accent focus:text-foreground"

export function SidebarProfileMenu({ name, email, photoURL, planName, collapsed = false, theme, onNavigate, onSignOut }: {
  name: string
  email?: string | null
  photoURL?: string | null
  planName?: string
  collapsed?: boolean
  theme: "light" | "dark"
  onNavigate?: () => void
  onSignOut: () => void | Promise<void>
}) {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open account menu for ${name}`}
          title={collapsed ? name : undefined}
          className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-card data-[state=open]:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0")}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={photoURL ?? undefined} alt="" className="object-cover" />
            <AvatarFallback className="bg-card text-xs font-semibold text-foreground">{initial}</AvatarFallback>
          </Avatar>
          {!collapsed && <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{name}</span>
              {planName && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{planName} plan</span>}
            </span>
            <ChevronUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} collisionPadding={12} className={cn("w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border-border bg-popover p-1.5 text-popover-foreground shadow-lg", theme === "dark" && "dark")}>
        <section className="min-w-0 px-3 py-3" aria-label="Your account">
          <p className="truncate text-sm font-medium">{name}</p>
          {email && <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>}
          {planName && <p className="mt-1 text-xs text-muted-foreground">{planName} plan</p>}
        </section>
        <DropdownMenuSeparator className="mx-2 my-1" />
        <DropdownMenuItem className={menuItemClass} onSelect={() => { onNavigate?.(); openSettings() }}>
          <SettingsIcon className="size-4 text-muted-foreground" aria-hidden />Settings
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass} onSelect={() => { onNavigate?.(); router.push("/pricing") }}>
          <BillingIcon className="size-4 text-muted-foreground" aria-hidden />Billing &amp; plans
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-2 my-1" />
        <DropdownMenuItem className={cn(menuItemClass, "text-destructive focus:bg-destructive/10 focus:text-destructive")} onSelect={() => { void onSignOut() }}>
          <SignOutIcon className="size-4" aria-hidden />Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
