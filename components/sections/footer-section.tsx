import Link from "next/link"

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Pricing" },
      { href: "/projects", label: "Projects" },
      { href: "/help", label: "Help" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/help", label: "About" },
      { href: "/settings", label: "Account" },
      { href: "#", label: "Careers" },
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
    <footer className="bg-background px-4 pb-8 pt-2 sm:px-6 sm:pb-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-secondary/55 p-5 sm:p-7 lg:p-8">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <img
                  src="/Images/lotus-official-logo.png"
                  alt="lotus.build"
                  className="h-9 w-9 object-contain"
                />
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  Lotus.build
                </span>
              </Link>

              <p className="mt-8 max-w-xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl">
                Build from a sentence, then keep shaping.
              </p>

              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                A calm AI workspace for founders turning rough ideas into polished product surfaces.
              </p>
            </div>

            <nav
              aria-label="Footer navigation"
              className="grid gap-6 rounded-[1.5rem] bg-card p-5 sm:grid-cols-3 sm:p-6"
            >
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {group.title}
                  </p>
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

          <div className="mt-10 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Lotus.build</p>
            <p>Made for founders building real companies.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

