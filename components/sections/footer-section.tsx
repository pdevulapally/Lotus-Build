import Link from "next/link"
import { LotusLogo } from "@/components/ui/lotus-logo"

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Pricing" },
      { href: "/", label: "Projects" },
      { href: "/help", label: "Help" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/help", label: "About" },
      { href: "/settings", label: "Account" },
      { href: "#", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/privacy#security", label: "Security" },
    ],
  },
] as const

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-background px-4 pb-10 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <LotusLogo size={32} />
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Lotus.build
              </span>
            </Link>

            <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
              A calm AI workspace for founders turning rough ideas into polished product surfaces.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-medium text-foreground">{group.title}</p>
                <div className="mt-4 flex flex-col gap-3">
                  {group.links.map((link) => (
                    <Link
                      key={`${group.title}-${link.label}`}
                      href={link.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lotus.build</p>
          <p>Made for founders building real companies.</p>
        </div>
      </div>
    </footer>
  )
}
