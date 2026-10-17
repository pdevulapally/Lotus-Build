"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight, Menu, Settings, LogOut } from "lucide-react"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import styles from "./navbar.module.css"

const links = [
  { href: "/welcome#workflow", label: "How it works" },
  { href: "/welcome#saved-work", label: "Your work" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
]

/** Shared public-site header. Project navigation and editor controls remain contextual. */
export function Navbar() {
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const { openSettings } = useSettingsDialog()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const accountName = user?.displayName?.trim() || user?.email?.split("@")[0] || "Your account"
  const accountInitial = user?.displayName?.trim().charAt(0).toUpperCase()
    || user?.email?.trim().charAt(0).toUpperCase()
    || "U"
  const active = (href: string) => !href.includes('#') && pathname === href
  const exit = async () => {
    setSigningOut(true); setError(null)
    try { await signOut() }
    catch { setError("Could not sign out. Try again.") }
    finally { setSigningOut(false) }
  }
  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link href="/welcome" aria-label="LotusBuild home" className={styles.brand}><BrandWordmark size="nav" /></Link>
      <nav aria-label="Main navigation" className={styles.desktop}>
        {links.map(link => <Link key={link.href} href={link.href} className={styles.navLink} aria-current={active(link.href) ? 'page' : undefined}>{link.label}</Link>)}
      </nav>
      <div className={styles.actions}>
        {loading ? <span role="status" className={styles.loading}>Loading account…</span> : <>
          {!user && <Link href="/login" className={styles.login} aria-current={pathname === '/login' ? 'page' : undefined}>Log in</Link>}
          <Link href={user ? '/' : '/signup'} className="site-action" aria-current={!user && pathname === '/signup' ? 'page' : undefined}>{user ? 'Open workspace' : 'Start building'}<ArrowUpRight size={15} aria-hidden /></Link>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`${styles.iconButton} ${styles.accountControl} ${styles.profileButton}`}
                  type="button"
                  aria-label={`Open account menu for ${accountName}`}
                >
                  <Avatar className="size-8">
                    <AvatarImage src={user.photoURL ?? undefined} alt="" referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                      {accountInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 py-2.5 font-normal">
                  <span className="block truncate text-sm font-medium text-foreground">{accountName}</span>
                  {user.email && (
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-lg px-3 py-2" onSelect={() => openSettings()}>
                  <Settings size={16} />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg px-3 py-2"
                  disabled={signingOut}
                  onSelect={() => void exit()}
                >
                  <LogOut size={16} />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className={`${styles.iconButton} ${styles.mobile}`} type="button" aria-label="Open navigation">
              <Menu size={21} />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-background text-foreground">
            <SheetTitle>Navigation</SheetTitle>
          {user && <div className="mt-6 flex min-w-0 items-center gap-3 border-b border-border pb-5">
            <Avatar className="size-10 shrink-0 ring-1 ring-border">
              <AvatarImage src={user.photoURL ?? undefined} alt="" referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">{accountInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{accountName}</p>
              {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
          </div>}
            <nav aria-label="Mobile navigation" className={styles.mobileLinks}>
              {links.map(link => (
                <Link key={link.href} href={link.href} aria-current={active(link.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                  {link.label}
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
              ))}
              <Link href={user ? '/' : '/login'} onClick={() => setMenuOpen(false)}>
                {user ? 'Open workspace' : 'Log in'}
                <ArrowUpRight size={16} aria-hidden />
              </Link>
              {user && (
                <>
                  <button type="button" onClick={() => { setMenuOpen(false); openSettings() }}>
                    Settings
                    <Settings size={16} aria-hidden />
                  </button>
                  <button type="button" disabled={signingOut} onClick={() => { setMenuOpen(false); void exit() }}>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                    <LogOut size={16} aria-hidden />
                  </button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </header>
}
