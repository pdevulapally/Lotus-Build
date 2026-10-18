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

export const BrowserIcon = PreviewIcon

export const FilesIcon = (props: IconProps) => (
  <Icon {...props}><path d="M3.75 7.5a2.25 2.25 0 0 1 2.25-2.25h3.6l2.1 2.25h6.3a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25Z" /><path d="m10.25 11.5-1.9 1.75 1.9 1.75m3.5-3.5 1.9 1.75-1.9 1.75" /></Icon>
)

export const ResearchIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="10.5" cy="10.5" r="6.25" /><path d="m15.1 15.1 4.65 4.65M8 10.5h5" /></Icon>
)

export const ExpandIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 4.75H4.75V9M4.75 4.75l5.5 5.5M15 19.25h4.25V15M19.25 19.25l-5.5-5.5" /></Icon>
)

export const CollapseIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4.75 4.75 9.25 9.25M5.75 9.25h3.5v-3.5M19.25 19.25l-4.5-4.5m0 3.5v-3.5h3.5" /></Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6.5 6.5 11 11m0-11-11 11" /></Icon>
)

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}><path d="m4.5 10 7.5-6 7.5 6v8.25A2.25 2.25 0 0 1 17.25 20.5H6.75A2.25 2.25 0 0 1 4.5 18.25V10Z" /><path d="M9.25 20.5v-6.25h5.5v6.25" /></Icon>
)

export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}><path d="M19.25 8.5A7.75 7.75 0 0 0 5.1 6.65L3.75 8M3.75 4.75V8H7m-2.25 7.5a7.75 7.75 0 0 0 14.15 1.85L20.25 16M20.25 19.25V16H17" /></Icon>
)

export const BillingIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.75" y="5.75" width="16.5" height="12.5" rx="2.5" /><path d="M4 10h16M7.25 14.5h4.5" /></Icon>
)

export const SignOutIcon = (props: IconProps) => (
  <Icon {...props}><path d="M13 4.75H6.5A2.25 2.25 0 0 0 4.25 7v10a2.25 2.25 0 0 0 2.25 2.25H13" /><path d="M9 12h10m-3.5-3.5L19 12l-3.5 3.5" /></Icon>
)

export const ChevronUpDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="m8 9.5 4-4 4 4m-8 5 4 4 4-4" /></Icon>
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
