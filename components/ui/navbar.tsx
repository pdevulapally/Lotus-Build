"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  ChevronDown,
  Coins,
  LayoutDashboard,
  Leaf,
  LogOut,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/#features", label: "Product" },
  { href: "/teams", label: "Teams" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
]

const accountMenuItemClass =
  "h-10 cursor-pointer rounded-lg px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

type NavbarProps = {
  variant?: "default" | "hero"
}

export function Navbar({ variant = "default" }: NavbarProps) {
  const router = useRouter()
  const { user, userData, loading, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    }
    if (email) return email[0].toUpperCase()
    return "U"
  }

  const remainingClamped = userData ? Math.max(0, userData.tokenUsage?.remaining ?? 0) : 0
  const tokensLimit = userData ? userData.tokenUsage.used + remainingClamped : 0
  const tokenPercentage = userData && tokensLimit > 0
    ? Math.min(100, Math.round((userData.tokenUsage.used / tokensLimit) * 100))
    : 0

  const headerClass = variant === "hero"
    ? "relative z-20 flex w-full justify-center px-0"
    : "fixed left-0 right-0 top-4 z-40 px-4 sm:top-5"

  return (
    <header className={headerClass}>
      <nav
        className={cn(
          "mx-auto grid h-13 w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border/70 bg-background/88 px-3 text-foreground shadow-[0_18px_70px_-54px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:px-4 md:grid-cols-[1fr_auto_1fr]",
          variant === "hero" && "bg-background/86 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.95)]"
        )}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2 md:justify-self-start">
          <LotusLogo size={26} />
          <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            Lotus.build
          </span>
        </Link>

        <div className="hidden items-center justify-center gap-0.5 rounded-full border border-border/50 bg-muted/35 p-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:justify-self-end">
          {!mounted || loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user && userData ? (
            <>
              <Link
                href="/projects"
                className="hidden h-9 items-center rounded-full bg-foreground px-3 text-[13px] font-semibold text-background transition hover:bg-foreground/85 sm:inline-flex"
              >
                Projects
              </Link>
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-1.5 pr-2 text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                    aria-label="Open account menu"
                  >
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarImage src={userData.photoURL || undefined} alt={userData.displayName || "User"} />
                      <AvatarFallback className="bg-muted text-[11px] text-foreground">
                        {getInitials(userData.displayName, userData.email)}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-xl border border-border bg-card p-0 text-popover-foreground shadow-lg"
                  sideOffset={10}
                >
                  <DropdownMenuLabel className="px-4 py-4 font-normal">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 border border-border">
                        <AvatarImage src={userData.photoURL || undefined} />
                        <AvatarFallback className="bg-muted text-sm text-foreground">
                          {getInitials(userData.displayName, userData.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium leading-5 text-foreground">
                          {userData.displayName || "User"}
                        </span>
                        <span className="block truncate text-[12.5px] leading-5 text-muted-foreground">{userData.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator className="m-0 bg-border" />

                  <div className="px-3 py-3">
                    <div className="rounded-xl border border-border/65 bg-muted/45 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background text-foreground">
                              <Leaf className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate text-[13px] font-medium text-foreground capitalize">{userData.planName} Plan</span>
                          </div>
                          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                            {remainingClamped.toLocaleString()} tokens available
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-background"
                          onClick={() => setIsOpen(false)}
                        >
                          Upgrade
                        </Link>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-3 text-[11.5px]">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Coins className="h-3.5 w-3.5" />
                            Tokens used
                          </span>
                          <span className="shrink-0 font-medium text-foreground">
                            {userData.tokenUsage.used.toLocaleString()} / {tokensLimit.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${tokenPercentage}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="m-0 bg-border" />

                  <div className="p-2">
                    <DropdownMenuItem
                      className={accountMenuItemClass}
                      onClick={() => {
                        setIsOpen(false)
                        router.push("/projects")
                      }}
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Projects
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className={accountMenuItemClass}
                      onClick={() => {
                        setIsOpen(false)
                        router.push("/settings")
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator className="m-0 bg-border" />

                  <div className="p-2">
                    <DropdownMenuItem
                      className="h-10 cursor-pointer rounded-lg px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background transition hover:bg-foreground/85"
            >
              Sign in
            </Link>
          )}

          <div className="flex md:hidden">
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                    aria-label="Open navigation"
                  >
                    <span className="relative block h-3.5 w-4.5">
                      <span className="absolute left-0 top-0 block h-[2px] w-4.5 rounded-full bg-current" />
                      <span className="absolute bottom-0 left-1 block h-[2px] w-3.5 rounded-full bg-current" />
                    </span>
                  </button>
                </SheetTrigger>
                <SheetContent side="top" className="h-screen bg-background px-5 pb-8 pt-16 text-foreground">
                  <SheetHeader className="p-0 pb-6">
                    <SheetTitle className="text-left text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Navigation
                    </SheetTitle>
                  </SheetHeader>
                  <div className="divide-y divide-border border-y border-border">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center justify-between py-4 text-2xl font-medium tracking-[-0.03em] text-foreground transition-colors hover:text-muted-foreground"
                      >
                        {link.label}
                        <span className="text-sm text-muted-foreground">Open</span>
                      </Link>
                    ))}
                    <Link
                      href={user ? "/projects" : "/login"}
                      className="flex items-center justify-between py-4 text-2xl font-medium tracking-[-0.03em] text-foreground transition-colors hover:text-muted-foreground"
                    >
                      {user ? "Projects" : "Sign in"}
                      <span className="text-sm text-muted-foreground">Open</span>
                    </Link>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-foreground"
                aria-label="Open navigation"
                disabled
              >
                <span className="relative block h-3.5 w-4.5">
                  <span className="absolute left-0 top-0 block h-[2px] w-4.5 rounded-full bg-current" />
                  <span className="absolute bottom-0 left-1 block h-[2px] w-3.5 rounded-full bg-current" />
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
