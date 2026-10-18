/** LotusBuild panel controls: a rounded frame with the toggled rail tinted, so the icon reads as the panel it moves. */
export function SidebarToggleIcon({ className, side = "left", open = true }: { className?: string; side?: "left" | "right"; open?: boolean }) {
  const rail = side === "left"
    ? "M6.5 4.25H9v15.5H6.5a3.25 3.25 0 0 1-3.25-3.25v-9A3.25 3.25 0 0 1 6.5 4.25Z"
    : "M17.5 4.25H15v15.5h2.5a3.25 3.25 0 0 0 3.25-3.25v-9A3.25 3.25 0 0 0 17.5 4.25Z"
  const divider = side === "left" ? "M9 4.75v14.5" : "M15 4.75v14.5"
  const dots = side === "left" ? "M5.75 8.5h.5m-.5 3.5h.5m-.5 3.5h.5" : "M17.75 8.5h.5m-.5 3.5h.5m-.5 3.5h.5"
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="3.25" y="4.25" width="17.5" height="15.5" rx="3.25" stroke="currentColor" strokeWidth="1.5" />
    <path d={rail} fill="currentColor" fillOpacity={open ? ".18" : "0"} className="transition-[fill-opacity] duration-200" />
    <path d={divider} stroke="currentColor" strokeWidth="1.5" />
    <path d={dots} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
}
