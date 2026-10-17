/** LotusBuild sidebar control: a solid navigation rail inside an open workspace. */
export function SidebarToggleIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="3.25" y="4.25" width="17.5" height="15.5" rx="3.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.5 4.25H9v15.5H6.5a3.25 3.25 0 0 1-3.25-3.25v-9A3.25 3.25 0 0 1 6.5 4.25Z" fill="currentColor" fillOpacity=".16" />
    <path d="M9 4.75v14.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.75 8.5h.5m-.5 3.5h.5m-.5 3.5h.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
}
