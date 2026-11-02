import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
)

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

export const TerminalIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.5" y="4.75" width="17" height="14.5" rx="3" /><path d="M7.25 10.25 10 12.5l-2.75 2.25M12.75 15h4" /></Icon>
)

export const DesktopIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.25" y="4.25" width="17.5" height="12.75" rx="2.75" /><path d="M12 17v3m-3.25 0h6.5" /></Icon>
)

export const WebsiteIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.25" y="4.75" width="17.5" height="14.5" rx="3.25" /><path d="M3.25 9.25h17.5" /><path d="M7 13h5.5M7 15.75h3" /><rect x="14.75" y="12.5" width="2.75" height="3.75" rx=".75" /></Icon>
)

export const TeamAppIcon = (props: IconProps) => (
  <Icon {...props}><rect x="4" y="4" width="6.75" height="6.75" rx="2" /><rect x="13.25" y="4" width="6.75" height="6.75" rx="2" /><rect x="4" y="13.25" width="6.75" height="6.75" rx="2" /><circle cx="16.6" cy="16.6" r="3.4" /></Icon>
)

export const AppIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.75" />
    <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.75" transform="rotate(12 17 7)" />
    <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.75" />
    <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.75" />
  </Icon>
)

export const PlanIcon = (props: IconProps) => (
  <Icon {...props}><path d="m4.5 6.75 1.5 1.5 2.75-2.75" /><path d="m4.5 13.25 1.5 1.5 2.75-2.75" /><path d="M11.75 7h7.75M11.75 13.5h7.75M5.5 19h14" opacity=".55" /></Icon>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 5v14" /><path d="m6.75 13.75 5.25 5.25 5.25-5.25" /></Icon>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}><path d="M5 12h14" /><path d="m13.75 6.75 5.25 5.25-5.25 5.25" /></Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon strokeWidth="2.2" {...props}><path d="m5.5 12.5 4 4 9-9.5" /></Icon>
)

export const ToolIcon = (props: IconProps) => (
  <Icon {...props}><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5Z" /><path d="M9.5 4.5 5 9" opacity=".55" /><path d="m4.5 15.5 4 4" opacity=".55" /></Icon>
)

export const WorkflowIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.75" y="3.75" width="10.5" height="6.5" rx="2" />
    <path d="M7 7h4M7 10.25v4.5a2 2 0 0 0 2 2h.75" />
    <rect x="9.75" y="13.5" width="10.5" height="6.5" rx="2" />
    <path d="m12.75 16.75 1.5 1.5 3-3" />
  </Icon>
)

export const BlocksIcon = (props: IconProps) => (
  <Icon {...props}><rect x="4" y="12.5" width="7.25" height="7.25" rx="1.75" /><rect x="12.75" y="12.5" width="7.25" height="7.25" rx="1.75" /><rect x="8.4" y="4" width="7.25" height="7.25" rx="1.75" /></Icon>
)

export const VersionsIcon = (props: IconProps) => (
  <Icon {...props}><rect x="6.5" y="9.5" width="13.5" height="10.5" rx="2.25" /><path d="M4 15.5V7.75A2.75 2.75 0 0 1 6.75 5H15" opacity=".55" /><path d="m10 15 2 2 4-4.25" /></Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 4.5v10" /><path d="m7.75 10.5 4.25 4.25 4.25-4.25" /><path d="M4.75 16.5v1.25a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2V16.5" opacity=".6" /></Icon>
)

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 3.75 5.25 6.5v5c0 4.1 2.85 7.3 6.75 8.75 3.9-1.45 6.75-4.65 6.75-8.75v-5L12 3.75Z" /><path d="m9.25 12 2 2 3.75-4" /></Icon>
)

export const LockIcon = (props: IconProps) => (
  <Icon {...props}><rect x="5" y="10.5" width="14" height="9.5" rx="2.25" /><path d="M8.25 10.5V8a3.75 3.75 0 0 1 7.5 0v2.5" /><circle cx="12" cy="15.25" r="1.1" fill="currentColor" stroke="none" /></Icon>
)

export const MailCodeIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.25" y="5.5" width="17.5" height="13" rx="2.75" /><path d="m3.75 7.5 8.25 6 8.25-6" /></Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon strokeWidth="2" {...props}><path d="M12 19V5" /><path d="m6.75 10.25 5.25-5.25 5.25 5.25" /></Icon>
)

export const GitBranchIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="7" cy="5.5" r="2.25" /><circle cx="7" cy="18.5" r="2.25" /><circle cx="17" cy="8.5" r="2.25" /><path d="M7 7.75v8.5" /><path d="M17 10.75c0 2.5-1.6 3.9-4.25 4.4-2.1.4-4.2.8-5.75 1.1" opacity=".7" /></Icon>
)

/** Continuation card: a usage dial whose needle sits on the limit. */
export function AllowanceLimitIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <path d="M4.5 16.5a7.5 7.5 0 1 1 15 0" />
      <path d="M12 16.5l4.4-4.4" strokeWidth="2" />
      <circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M19.5 16.5h1.25M3.25 16.5H4.5" opacity=".55" />
    </Icon>
  )
}

/** Continuation card: queued, waiting on the provider — an hourglass mid-pour. */
export function QueuedIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <path d="M7 3.75h10M7 20.25h10" />
      <path d="M8 3.75v2.6c0 2.3 1.6 3.7 4 5.65 2.4-1.95 4-3.35 4-5.65v-2.6" />
      <path d="M8 20.25v-2.6c0-2.3 1.6-3.7 4-5.65 2.4 1.95 4 3.35 4 5.65v2.6" />
      <path d="M10.4 17.6h3.2" opacity=".55" />
    </Icon>
  )
}

/** Continuation card: paused with nothing to offer yet. */
export function PausedIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M10 8.75v6.5M14 8.75v6.5" strokeWidth="2" />
    </Icon>
  )
}

/** Continuation card: running or finished on the free model — a forward arrow leaving a dial. */
export function ContinuedIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <path d="M4.5 16.5a7.5 7.5 0 0 1 13.2-4.8" />
      <path d="M13.5 8.5h4.6V3.9" />
      <path d="M8.5 16.5h7" opacity=".55" />
    </Icon>
  )
}

/** Request notices: something needs attention — a rounded notice mark. */
export function NoticeIcon(props: IconProps) {
  return (
    <Icon strokeWidth="1.7" {...props}>
      <path d="M12 3.75 20.25 18.5H3.75L12 3.75Z" />
      <path d="M12 9.5v4" strokeWidth="2" />
      <circle cx="12" cy="16" r=".9" fill="currentColor" stroke="none" />
    </Icon>
  )
}
