import { lotusBuildSupportEmail } from '@/lib/lotus-build-site-content'

/** Facts shared by every legal document. Change them here, never inline in a page. */
export const legalIdentity = {
  tradingName: 'LotusBuild',
  legalName: 'SR IT SUPPORT SERVICES LTD',
  siteUrl: 'https://lotusbuild.co.uk',
  contactEmail: lotusBuildSupportEmail,
  governingLaw: 'the laws of England and Wales',
  courts: 'the courts of England and Wales',
  minimumAge: 18,
  supervisoryAuthority: { name: "Information Commissioner's Office (ICO)", url: 'https://ico.org.uk/make-a-complaint/' },
} as const

export type LegalInline = string | { text: string; href: string } | { strong: string }
export type LegalRich = LegalInline | readonly LegalInline[]

export type LegalBlock =
  | { kind: 'p'; text: LegalRich }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: readonly LegalRich[]; ordered?: boolean }
  | { kind: 'callout'; variant?: 'info' | 'warn'; text: LegalRich }
  | { kind: 'table'; label: string; columns: readonly string[]; rows: readonly (readonly LegalRich[])[] }
  | { kind: 'definitions'; items: readonly { term: string; description: LegalRich }[] }

export type LegalSection = { id: string; label: string; title: string; blocks: readonly LegalBlock[] }

export type LegalDocumentContent = {
  title: string
  description: string
  effectiveDate: string
  lastUpdated: string
  notice?: string
  related: { href: string; label: string }
  contact: { title: string; description: string }
  sections: readonly LegalSection[]
}

export const email = (): LegalInline => ({ text: legalIdentity.contactEmail, href: `mailto:${legalIdentity.contactEmail}` })
export const link = (text: string, href: string): LegalInline => ({ text, href })
export const strong = (text: string): LegalInline => ({ strong: text })
