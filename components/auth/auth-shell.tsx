"use client"
import type { ReactNode } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import { RevealGroup, RevealItem } from "@/components/ui/reveal"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"

/** Shared frame for sign-in, sign-up and verification: open brand copy on the left, one focused form on the right. */
export function AuthShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main data-auth-theme="dark" className="dark auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <header className="site-shell flex items-center py-6 sm:py-8">
        <Link href="/welcome" aria-label="LotusBuild home" className="hidden lg:block">
          <BrandWordmark size="nav" />
        </Link>
        <Link
          href="/welcome"
          aria-label="Exit sign in"
          className="ml-auto flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </header>
      <div className="site-shell flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
        <RevealGroup animateOnMount className="grid w-full max-w-[460px] items-center gap-8 lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16 xl:gap-24">
          <RevealItem className="hidden lg:block"><AuthMarketingPanel /></RevealItem>
          <RevealItem
            as="section"
            className="min-w-0 py-10 sm:py-12 lg:rounded-[28px] lg:border lg:border-border lg:bg-card lg:px-9 lg:py-9"
            aria-label={label}
          >
            {children}
          </RevealItem>
        </RevealGroup>
      </div>
    </main>
  )
}
