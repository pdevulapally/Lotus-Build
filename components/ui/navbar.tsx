"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Settings,
  LogOut,
  Coins,
  Leaf,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react"

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/teams", label: "Teams" },
  { href: "/pricing", label: "Pricing" },
]

const accountMenuItemClass =
  "h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

export function Navbar() {
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
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return "U"
  }

  const remainingClamped = userData ? Math.max(0, userData.tokenUsage?.remaining ?? 0) : 0
  const tokensLimit = userData ? userData.tokenUsage.used + remainingClamped : 0
  const tokenPercentage = userData && tokensLimit > 0
    ? Math.min(100, Math.round((userData.tokenUsage.used / tokensLimit) * 100))
    : 0

  return (
    <header className="fixed left-0 right-0 top-6 z-40 px-4 sm:top-7">
      <nav className="relative max-w-5xl w-full mx-auto flex h-12 items-center justify-between px-4 sm:px-6 rounded-full bg-card/90 border border-border shadow-[0_18px_60px_-42px_var(--primary)] backdrop-blur-xl md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 md:justify-self-start">
          <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-7 w-7 object-contain" />
          <span className="font-display text-lg font-semibold text-foreground">Lotus.build</span>
        </Link>

        {/* Center Nav Links (desktop/tablet) */}
        <div className="hidden md:flex items-center justify-center gap-1 justify-self-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-1.5 text-sm rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Side */}
        <div className="ml-auto flex items-center gap-2 md:ml-0 md:justify-self-end">
          {/* User/profile + auth (all breakpoints) */}
          {!mounted || loading ? (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          ) : user && userData ? (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={userData.photoURL || undefined} alt={userData.displayName || "User"} />
                    <AvatarFallback className="bg-muted text-foreground text-xs">
                      {getInitials(userData.displayName, userData.email)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-muted-foreground hidden xs:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-2xl border-border bg-card p-0 text-popover-foreground shadow-[0_24px_80px_-44px_var(--primary)]"
                sideOffset={10}
              >
                {/* User Info */}
                <DropdownMenuLabel className="px-4 py-4 font-normal">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0 border border-border">
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

                {/* Plan & Tokens */}
                <div className="px-3 py-3">
                  <div className="rounded-2xl bg-muted/50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground">
                            <Leaf className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-[13px] font-medium text-foreground capitalize">{userData.planName} Plan</span>
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                          {Math.max(0, remainingClamped).toLocaleString()} tokens available
                        </p>
                      </div>
                      <Link
                        href="/pricing"
                        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground"
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
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(tokenPercentage, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="m-0 bg-border" />

                {/* Menu Items */}
                <div className="p-2">
                  <DropdownMenuItem
                    className={accountMenuItemClass}
                    onClick={() => {
                      setIsOpen(false)
                      router.push("/projects")
                    }}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Your Projects
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className={accountMenuItemClass}
                    onClick={() => {
                      setIsOpen(false)
                      router.push("/settings")
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="m-0 bg-border" />

                <div className="p-2">
                  <DropdownMenuItem
                    className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                className="px-4 py-1.5 text-sm rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Button>
            </Link>
          )}

          {/* Mobile nav sheet – just links */}
          <div className="flex md:hidden">
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Open navigation"
                  >
                    <span className="relative block h-3.5 w-4.5">
                      <span className="absolute left-0 top-0 block h-[2px] w-4.5 rounded-full bg-current" />
                      <span className="absolute bottom-0 left-1 block h-[2px] w-3.5 rounded-full bg-current" />
                    </span>
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="top"
                  className="h-screen bg-background px-6 pb-10 pt-16 text-foreground"
                >
                  <SheetHeader className="p-0 pb-4">
                    <SheetTitle className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Navigation
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded-2xl border border-border bg-card px-4 py-3 text-2xl font-medium leading-tight tracking-wide text-foreground transition-colors hover:bg-muted sm:text-3xl"
                      >
                        {link.label}
                      </Link>
                    ))}
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