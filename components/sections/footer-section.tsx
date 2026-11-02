import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import styles from "./footer-section.module.css"
import { legalIdentity } from "@/lib/legal/model"
import { CookiePreferencesButton } from "@/components/cookie-banner"

const links = [
  { href: "/welcome#workflow", label: "How it works" },
  { href: "/welcome#saved-work", label: "Project files & history" },
  { href: "/pricing", label: "Plans & pricing" },
  { href: "/help", label: "Help & support" },
]
const legalLinks = [
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/privacy#cookies", label: "Cookies" },
  { href: "/privacy#security", label: "Security" },
]
export function FooterSection({ stacked = false }: { stacked?: boolean } = {}) {
  return <footer className={`${styles.footer}${stacked ? ` ${styles.stacked}` : ''}`}>
    <div className={styles.inner}>
      <div className={styles.main}>
        <div className={styles.about}>
          <Link href="/welcome" aria-label="LotusBuild home" className={styles.brand}><BrandWordmark /></Link>
          <p className={styles.statement}>From an idea to<br />something you can use.</p>
          <p className={styles.description}>Describe what you want to make. Plan it, build it, and keep improving it with LotusBuild.</p>
        </div>
        <nav aria-label="Footer navigation" className={styles.navigation}>
          <p className={styles.label}>Explore LotusBuild</p>
          <ul>{links.map(link => <li key={link.href}>
            <Link href={link.href}><span>{link.label}</span><ArrowUpRight size={18} strokeWidth={1.5} aria-hidden /></Link>
          </li>)}</ul>
        </nav>
      </div>
      <div className={styles.bottom}>
        <div className={styles.companyDetails}>
          <span>© {new Date().getFullYear()} LotusBuild · Operated by {legalIdentity.legalName}</span>
          <span>Registered in {legalIdentity.registrationJurisdiction} · Company no. <a href={legalIdentity.companiesHouseUrl} target="_blank" rel="noopener noreferrer">{legalIdentity.companyNumber}</a></span>
        </div>
        <nav aria-label="Legal information"><ul>{legalLinks.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}<li><CookiePreferencesButton className="inline-flex min-h-11 items-center rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" /></li></ul></nav>
      </div>
    </div>
  </footer>
}
