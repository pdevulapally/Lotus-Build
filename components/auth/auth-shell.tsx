"use client"
import type { ReactNode } from "react"
import { Navbar } from "@/components/ui/navbar"
import { RevealGroup, RevealItem } from "@/components/ui/reveal"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"

/** Shared frame for sign-in, sign-up and verification: brand panel on the left, one focused card on the right. */
export function AuthShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main className="auth-backdrop relative flex min-h-[100dvh] flex-col text-foreground">
      <Navbar />
      <div className="site-shell flex flex-1 items-center justify-center py-6 sm:py-10 lg:py-14">
        <RevealGroup animateOnMount className="grid w-full max-w-[440px] gap-6 lg:max-w-[1040px] lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-8">
          <RevealItem className="hidden lg:block"><AuthMarketingPanel /></RevealItem>
          <RevealItem as="section" className="min-w-0 rounded-[28px] bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_24px_60px_-32px_rgb(0_0_0/0.25)] ring-1 ring-border/60 sm:p-9" aria-label={label}>
            {children}
          </RevealItem>
        </RevealGroup>
      </div>
    </main>
  )
}
