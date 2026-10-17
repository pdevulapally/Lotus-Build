"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight, Menu, Settings, LogOut, UserRound } from "lucide-react"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import { useAuth } from "@/contexts/auth-context"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
  const active = (href: string) => !href.includes('#') && pathname === href
  const exit = async () => {
    setSigningOut(true); setError(null)
    try { await signOut() }
    catch { setError("Could not sign out. Try again.") }
    finally { setSigningOut(false) }
  }
  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link href="/welcome" aria-label="LotusBuild home" className={styles.brand}><BrandWordmark /></Link>
      <nav aria-label="Main navigation" className={styles.desktop}>
        {links.map(link => <Link key={link.href} href={link.href} className={styles.navLink} aria-current={active(link.href) ? 'page' : undefined}>{link.label}</Link>)}
      </nav>
      <div className={styles.actions}>
        {loading ? <span role="status" className={styles.loading}>Loading account…</span> : <>
          {!user && <Link href="/login" className={styles.login} aria-current={pathname === '/login' ? 'page' : undefined}>Log in</Link>}
          <Link href={user ? '/' : '/signup'} className="site-action" aria-current={!user && pathname === '/signup' ? 'page' : undefined}>{user ? 'Open workspace' : 'Start building'}<ArrowUpRight size={15} aria-hidden /></Link>
          {user && <DropdownMenu><DropdownMenuTrigger asChild><button className={`${styles.iconButton} ${styles.accountControl}`} type="button" aria-label="Open account menu"><UserRound size={18} /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openSettings()}><Settings size={16} />Settings</DropdownMenuItem>
            <DropdownMenuItem disabled={signingOut} onSelect={() => void exit()}><LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>}
        </>}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetTrigger asChild><button className={`${styles.iconButton} ${styles.mobile}`} type="button" aria-label="Open navigation"><Menu size={21} /></button></SheetTrigger><SheetContent side="right" className="bg-background text-foreground"><SheetTitle>Navigation</SheetTitle><nav aria-label="Mobile navigation" className={styles.mobileLinks}>
          {links.map(link => <Link key={link.href} href={link.href} aria-current={active(link.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={16} aria-hidden /></Link>)}
          <Link href={user ? '/' : '/login'} onClick={() => setMenuOpen(false)}>{user ? 'Open workspace' : 'Log in'}<ArrowUpRight size={16} aria-hidden /></Link>
          {user && <><button type="button" onClick={() => { setMenuOpen(false); openSettings() }}>Settings<Settings size={16} aria-hidden /></button><button type="button" disabled={signingOut} onClick={() => { setMenuOpen(false); void exit() }}>Sign out<LogOut size={16} aria-hidden /></button></>}
        </nav></SheetContent></Sheet>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </header>
}
