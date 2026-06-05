import Link from "next/link"

export function FooterSection() {
  return (
    <footer className="border-t border-zinc-200 bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-8 w-8 object-contain" />
              <p className="text-2xl font-semibold tracking-tight text-foreground">Lotus.build</p>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
              A calm, premium website builder for founders. Turn ideas into polished websites with AI guidance and live editing.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.12em] text-zinc-500">Built for serious teams</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 md:col-span-7">
            <div>
              <p className="text-sm font-medium text-foreground">Product</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <Link href="/" className="block hover:text-foreground">Home</Link>
                <Link href="/pricing" className="block hover:text-foreground">Pricing</Link>
                <Link href="/projects" className="block hover:text-foreground">Projects</Link>
                <Link href="/help" className="block hover:text-foreground">Help</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Company</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <Link href="/help" className="block hover:text-foreground">About</Link>
                <Link href="/settings" className="block hover:text-foreground">Account</Link>
                <Link href="#" className="block hover:text-foreground">Careers</Link>
                <Link href="#" className="block hover:text-foreground">Contact</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Legal</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <Link href="/terms" className="block hover:text-foreground">Terms</Link>
                <Link href="/privacy" className="block hover:text-foreground">Privacy</Link>
                <Link href="/privacy#security" className="block hover:text-foreground">Security</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-zinc-200 pt-5 text-xs text-zinc-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Lotus.build. All rights reserved.</p>
          <p>Made for founders building real companies.</p>
        </div>
      </div>
    </footer>
  )
}

