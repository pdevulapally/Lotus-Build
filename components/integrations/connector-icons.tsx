import type { SVGProps } from 'react'
import type { ConnectorKey } from '@/lib/backend/connections'

type IconProps = SVGProps<SVGSVGElement>
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Hand-drawn glyphs in the lotus-icons stroke style — one shape per service, no brand marks. */
export const NetlifyGlyph = (p: IconProps) => (<svg {...base} {...p}><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><path d="M8.5 12h7M12 8.5v7" /></svg>)
export const VercelGlyph = (p: IconProps) => (<svg {...base} {...p}><path d="M12 4.5l8 14H4z" /><path d="M12 10.5v4" /></svg>)
export const SlackGlyph = (p: IconProps) => (<svg {...base} {...p}><path d="M9 4v7M15 13v7M4 15h7M13 9h7" /><circle cx="9" cy="15" r="1.4" /><circle cx="15" cy="9" r="1.4" /></svg>)
export const AwsGlyph = (p: IconProps) => (<svg {...base} {...p}><path d="M4 9.5h16v9H4z" /><path d="M7 9.5V7a5 5 0 0110 0v2.5" /><path d="M8 14h8" /></svg>)
export const McpGlyph = (p: IconProps) => (<svg {...base} {...p}><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>)
export const GrantGlyph = (p: IconProps) => (<svg {...base} {...p}><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7.5a4 4 0 018 0V10" /><path d="M12 14v2.5" /></svg>)

export const connectorGlyphs: Record<ConnectorKey, (p: IconProps) => React.JSX.Element> = { netlify: NetlifyGlyph, vercel: VercelGlyph, slack: SlackGlyph, aws: AwsGlyph, mcp: McpGlyph }

export function CheckGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 8.5l2.8 2.8L12.5 5" />
    </svg>
  )
}

export function ShieldGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 1.8l4.8 1.9v3.6c0 3-2 5.4-4.8 6.7C5.2 12.7 3.2 10.3 3.2 7.3V3.7L8 1.8z" />
      <path d="M6 8l1.4 1.4L10.2 6.6" />
    </svg>
  )
}

export function ChevronGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4.5 6.5L8 10l3.5-3.5" />
    </svg>
  )
}
