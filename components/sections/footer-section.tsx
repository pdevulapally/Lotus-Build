import Link from "next/link"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import styles from "./footer-section.module.css"

const groups = [
  { title: "Explore", links: [{ href: "/welcome#workflow", label: "How it works" }, { href: "/welcome#saved-work", label: "Your work" }, { href: "/pricing", label: "Pricing" }] },
  { title: "Workspace", links: [{ href: "/", label: "Projects" }, { href: "/settings", label: "Account" }, { href: "/help", label: "Help & support" }] },
  { title: "Legal", links: [{ href: "/terms", label: "Terms" }, { href: "/privacy", label: "Privacy" }, { href: "/privacy#security", label: "Security" }] },
]
export function FooterSection() {
  return <footer className={styles.footer}>
    <Link href="/welcome" aria-label="LotusBuild home" className={styles.brand}><BrandWordmark /></Link>
    <p className={styles.statement}>Good software starts with a clear idea.<br />Keep shaping yours.</p>
    <nav aria-label="Footer navigation" className={styles.groups}>{groups.map(group => <div key={group.title}><p>{group.title}</p>{group.links.map(link => <Link key={link.label} href={link.href}>{link.label}</Link>)}</div>)}</nav>
    <div className={styles.bottom}><span>© {new Date().getFullYear()} LotusBuild</span><Link href="/help#contact">Contact support</Link></div>
  </footer>
}
