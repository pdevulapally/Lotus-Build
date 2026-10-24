"use client"
import type { ReactNode } from "react"
import { Navbar } from "@/components/ui/navbar"
import { RevealGroup, RevealItem } from "@/components/ui/reveal"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"

/** Shared frame for sign-in, sign-up and verification: open brand copy on the left, one focused form on the right. */
export function AuthShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main data-auth-theme="dark" className="dark auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <Navbar />
      <div className="site-shell flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
        <RevealGroup animateOnMount className="grid w-full max-w-[460px] items-center gap-8 lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16 xl:gap-24">
          <RevealItem className="hidden lg:block"><AuthMarketingPanel /></RevealItem>
          <RevealItem as="section" className="min-w-0 rounded-[28px] border border-border bg-card p-6 sm:p-9" aria-label={label}>
            {children}
          </RevealItem>
        </RevealGroup>
      </div>
    </main>
  )
}
