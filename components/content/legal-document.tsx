"use client"

import { useEffect, useState, type ElementType, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUp, ArrowUpRight, ChevronDown, Info } from "lucide-react"
import { FooterSection } from "@/components/sections/footer-section"
import { Navbar } from "@/components/ui/navbar"
import { cn } from "@/lib/utils"
import { legalIdentity, type LegalBlock, type LegalDocumentContent, type LegalRich } from "@/lib/legal/model"

type DocumentSection = { id: string; label: string }

function DocumentContents({ sections, active }: { sections: readonly DocumentSection[]; active: string }) {
  return (
    <nav aria-label="Document sections" className="space-y-0.5">
      {sections.map(({ id, label }, index) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          className={cn(
            "flex min-h-10 items-baseline gap-3 border-l py-2 pl-4 pr-2 text-[13px] leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            active === id
              ? "border-foreground font-semibold text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          <span className="w-4 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          {label}
        </a>
      ))}
    </nav>
  )
}

export function LegalDocument({
  title,
  description,
  effectiveDate,
  lastUpdated,
  version,
  related,
  notice,
  sections,
  contact,
  children,
}: {
  title: string
  description: ReactNode
  effectiveDate: string
  lastUpdated: string
  version?: string
  related: { href: string; label: string }
  notice?: ReactNode
  sections: readonly DocumentSection[]
  contact: { title: string; description: string }
  children: ReactNode
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "")
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      let current = sections[0]?.id ?? ""
      for (const { id } of sections) {
        const heading = document.getElementById(id)
        if (heading && heading.getBoundingClientRect().top <= 120) current = id
      }
      setActive(current)
      setShowBack(window.scrollY > 400)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [sections])

  return (
    <div data-product-theme="dark" className="dark min-h-screen bg-background font-sans text-foreground">
      <Navbar />
      <main className="site-shell">
        <header className="border-b border-border pb-10 pt-16 sm:pb-12 sm:pt-24 lg:pb-14 lg:pt-28">
          <p className="site-eyebrow">Legal</p>
          <h1 className="site-title mt-5">{title}</h1>
          <p className="site-lead mt-6">{description}</p>
          <div className="mt-10 flex flex-col gap-3 text-xs leading-6 text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
            {version && <span>Version: {version}</span>}
            <span><span className="font-semibold text-foreground">Effective:</span> {effectiveDate}</span>
            <span><span className="font-semibold text-foreground">Last updated:</span> {lastUpdated}</span>
            <Link href={related.href} className="inline-flex w-fit items-center gap-2 rounded-sm font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {related.label} <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {notice && <p className="mt-6 max-w-2xl text-xs leading-6 text-muted-foreground">{notice}</p>}
        </header>

        <div className="grid gap-10 pb-20 pt-6 sm:pb-28 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20 lg:pt-14">
          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain pr-3 pb-4">
              <p className="site-eyebrow mb-5">On this page</p>
              <DocumentContents sections={sections} active={active} />
              <div className="mt-8 border-t border-border pt-5">
                <p className="text-sm font-semibold">{contact.title}</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{contact.description}</p>
                <a href={`mailto:${legalIdentity.contactEmail}`} className="mt-3 block break-words rounded-sm text-xs leading-6 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                  {legalIdentity.contactEmail}
                </a>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <details className="group mb-10 border-b border-border pb-5 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                On this page <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-4 max-h-[60dvh] overflow-y-auto overscroll-contain pr-2">
                <DocumentContents sections={sections} active={active} />
              </div>
            </details>
            <article className="max-w-[70ch] space-y-14 break-words text-[15px] leading-7 text-foreground sm:space-y-16 sm:text-base sm:leading-8 [&_a]:rounded-sm [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-ring">
              {children}
            </article>
          </div>
        </div>
      </main>

      {showBack && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          aria-label="Back to top"
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      )}
      <FooterSection />
    </div>
  )
}

export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1} className="mb-6 scroll-mt-28 text-xl font-semibold leading-snug tracking-[-0.035em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-2xl">
      {children}
    </h2>
  )
}

export function Callout({ icon, variant = "info", children }: { icon?: ElementType; variant?: "info" | "warn"; children: ReactNode }) {
  const Icon = icon ?? (variant === "warn" ? AlertTriangle : Info)
  return (
    <div className={cn(
      "my-6 flex gap-3 border-l-2 px-4 py-4 text-sm leading-7",
      variant === "warn" ? "border-warning/50 bg-warning-soft text-warning-soft-foreground" : "border-info/50 bg-info-soft text-info-soft-foreground"
    )}>
      <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Rich({ value }: { value: LegalRich }) {
  const parts = Array.isArray(value) ? value : [value]
  return <>{parts.map((part, i) => typeof part === "string" ? part : "href" in part ? <a key={i} href={part.href} target={part.href.startsWith("http") ? "_blank" : undefined} rel={part.href.startsWith("http") ? "noopener noreferrer" : undefined}>{part.text}</a> : <strong key={i} className="font-semibold text-foreground">{part.strong}</strong>)}</>
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p": return <p className="mb-4 text-muted-foreground"><Rich value={block.text} /></p>
    case "h3": return <h3 className="mb-3 mt-8 text-base font-semibold tracking-[-0.015em] text-foreground">{block.text}</h3>
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return <Tag className={cn("mb-5 space-y-2 pl-5 text-muted-foreground marker:text-muted-foreground", block.ordered ? "list-decimal" : "list-disc")}>{block.items.map((item, i) => <li key={i} className="pl-1"><Rich value={item} /></li>)}</Tag>
    }
    case "callout": return <Callout variant={block.variant}><Rich value={block.text} /></Callout>
    case "definitions": return (
      <dl className="mb-6 divide-y divide-border border-y border-border">
        {block.items.map((item) => <div key={item.term} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6"><dt className="text-sm font-semibold text-foreground">{item.term}</dt><dd className="text-sm leading-7 text-muted-foreground"><Rich value={item.description} /></dd></div>)}
      </dl>
    )
    case "table": return (
      <div className="my-6 overflow-x-auto border-y border-border focus-visible:outline-2 focus-visible:outline-ring" role="region" aria-label={block.label} tabIndex={0}>
        <table className="w-full min-w-[560px] text-left text-sm leading-6">
          <thead><tr className="border-b border-border bg-muted">{block.columns.map((column) => <th key={column} scope="col" className="px-4 py-3 font-semibold text-foreground">{column}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, i) => <tr key={i} className="border-b border-border last:border-0">{row.map((cell, j) => <td key={j} className={cn("px-4 py-3 align-top", j === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}><Rich value={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}

/** Renders a complete legal document from typed content so Privacy and Terms share one layout and one source of facts. */
export function LegalContentDocument({ content }: { content: LegalDocumentContent }) {
  return (
    <LegalDocument title={content.title} description={content.description} effectiveDate={content.effectiveDate} lastUpdated={content.lastUpdated} version={content.version} related={content.related} notice={content.notice} sections={content.sections} contact={content.contact}>
      {content.sections.map((section, index) => (
        <section key={section.id} aria-labelledby={section.id}>
          <SectionTitle id={section.id}>{index + 1}. {section.title}</SectionTitle>
          {section.blocks.map((block, i) => <Block key={i} block={block} />)}
        </section>
      ))}
    </LegalDocument>
  )
}
