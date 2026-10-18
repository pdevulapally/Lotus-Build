import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

export const UsageIcon = (props: IconProps) => (
  <Icon strokeWidth="1.8" {...props}><path d="M4.25 16.75a7.75 7.75 0 1 1 15.5 0" /><path d="M7.25 16.75a4.75 4.75 0 0 1 1.4-3.36" opacity=".5" /><path d="m12 16.75 3.75-4.5" /><circle cx="12" cy="16.75" r="1.5" fill="currentColor" stroke="none" /></Icon>
)

export const RenameIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4.75 19.25h4.5L18.6 9.9a2.12 2.12 0 0 0-3-3L6.25 16.25l-1.5 3Z" /><path d="m14.25 8.25 2.5 2.5" /><path d="M13.75 19.25h5.5" /></Icon>
)

export const HistoryIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4.75 12a7.25 7.25 0 1 0 2.12-5.13" /><path d="M4.75 4.75v3.5h3.5" /><path d="M12 8.5V12l2.25 1.5" /></Icon>
)

export const PreviewIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.25" y="4.75" width="17.5" height="14.5" rx="3.25" /><path d="M3.25 9.25h17.5" /><path d="M6.5 7h.01M8.75 7h.01" strokeWidth="2" /></Icon>
)

export const LiveSiteIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="8.25" /><path d="M3.75 12h16.5" /><path d="M12 3.75c2.2 2.3 3.25 5 3.25 8.25S14.2 17.95 12 20.25C9.8 17.95 8.75 15.25 8.75 12S9.8 6.05 12 3.75Z" /></Icon>
)

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}><rect x="8.25" y="8.25" width="11.5" height="11.5" rx="2.75" /><path d="M15.75 8.25V7a2.75 2.75 0 0 0-2.75-2.75H7A2.75 2.75 0 0 0 4.25 7v6A2.75 2.75 0 0 0 7 15.75h1.25" /></Icon>
)

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4.75 7.5h7.5M16.75 7.5h2.5M4.75 16.5h2.5M11.75 16.5h7.5" /><circle cx="14.5" cy="7.5" r="2.25" /><circle cx="9.5" cy="16.5" r="2.25" /></Icon>
)

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9.75 5.75H7.5a2.75 2.75 0 0 0-2.75 2.75v8A2.75 2.75 0 0 0 7.5 19.25h8a2.75 2.75 0 0 0 2.75-2.75v-2.25" /><path d="M13.75 4.75h5.5v5.5" /><path d="m19.25 4.75-8 8" /></Icon>
)
