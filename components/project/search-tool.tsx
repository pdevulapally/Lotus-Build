"use client"

import * as React from "react"
import { ChevronRight, FileText, Globe } from "lucide-react"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { cn } from "@/lib/utils"

export type SearchResult = {
  title: string
  source: string
  date?: string
}

export type SearchToolProps = {
  state?: "searching" | "done"
  query: string
  results?: SearchResult[]
  defaultOpen?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
  className?: string
}

function AnimatedGlobe({ className }: { className?: string }) {
  const uid = React.useId().replace(/:/g, "")
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <defs>
        <clipPath id={`${uid}c`}>
          <circle cx="12" cy="12" r="10" />
        </clipPath>
        {/* Gradient mask: opaque in center, transparent at edges — creates sphere depth */}
        <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="18%"  stopColor="white" stopOpacity="1" />
          <stop offset="82%"  stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${uid}m`}>
          <rect x="0" y="0" width="24" height="24" fill={`url(#${uid}g)`} />
        </mask>
      </defs>

      {/* Sphere outline */}
      <circle cx="12" cy="12" r="10" />

      {/* Latitude lines — static horizontal ellipses */}
      <ellipse cx="12" cy="12"   rx="10" ry="3.5" clipPath={`url(#${uid}c)`} />
      <ellipse cx="12" cy="7.5"  rx="8"  ry="2.5" clipPath={`url(#${uid}c)`} />
      <ellipse cx="12" cy="16.5" rx="8"  ry="2.5" clipPath={`url(#${uid}c)`} />

      {/* Meridian lines — animated vertical lines sliding right-to-left */}
      <g clipPath={`url(#${uid}c)`} mask={`url(#${uid}m)`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-7 0"
            dur="3s"
            repeatCount="indefinite"
          />
          <line x1="-2" y1="2" x2="-2" y2="22" />
          <line x1="5"  y1="2" x2="5"  y2="22" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="19" y1="2" x2="19" y2="22" />
          <line x1="26" y1="2" x2="26" y2="22" />
        </g>
      </g>
    </svg>
  )
}

export const SearchTool = React.memo(function SearchTool({
  state = "done",
  query,
  results = [],
  defaultOpen = false,
  expanded,
  onToggleExpand,
  className,
}: SearchToolProps) {
  const isControlled = expanded !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = isControlled ? !!expanded : internalOpen

  const isSearching = state === "searching"
  const totalResults = results.length
  const expandable = totalResults > 0

  const handleToggle = () => {
    if (!expandable) return
    if (isControlled) {
      onToggleExpand?.()
    } else {
      setInternalOpen((v) => !v)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!expandable}
        aria-expanded={expandable ? isOpen : undefined}
        className={cn(
          "group flex items-center max-w-full select-none gap-1.5 bg-transparent border-0 p-0 m-0 text-left",
          expandable ? "cursor-pointer" : "cursor-default",
        )}
      >
        {isSearching ? (
          <AnimatedGlobe className="shrink-0 text-muted-foreground" />
        ) : (
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex items-center gap-1.5 min-w-0 text-sm">
          {isSearching ? (
            <TextShimmer className="text-xs font-medium">
              Searching the web…
            </TextShimmer>
          ) : (
            <span className="text-xs font-[450] text-muted-foreground whitespace-nowrap shrink-0">
              Found {totalResults} result{totalResults === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {expandable && (
          <ChevronRight
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-150 ease-out h-3 w-3",
              isOpen ? "rotate-90" : "rotate-0",
            )}
          />
        )}
      </button>

      {expandable && isOpen && (
        <div className="overflow-hidden rounded-[10px] border border-border bg-muted shadow-sm">
          <div className="flex items-center px-2.5 h-7 border-b border-border text-xs gap-1">
            <span className="text-foreground font-medium">Searched for</span>
            {" "}
            <span className="text-muted-foreground truncate">
              &ldquo;{query}&rdquo;
            </span>
          </div>
          <div className="max-h-[200px] overflow-y-auto overflow-x-hidden bg-card [scrollbar-width:thin]">
            <div className="flex flex-col gap-0.5 p-1">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1 rounded-[6px] cursor-default hover:bg-secondary transition-colors min-w-0"
                >
                  <div className="flex items-center justify-center w-4 h-4 shrink-0 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-foreground truncate flex-1 min-w-0">
                    {result.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 max-w-[90px] truncate">
                    {(result.date || result.source).replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
