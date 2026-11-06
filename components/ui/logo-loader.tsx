import { cn } from "@/lib/utils"
import { LotusLogo } from "@/components/ui/lotus-logo"

/** The breathing LotusBuild mark: the one loading indicator used wherever a whole surface is waiting. */
export function LogoMark({ size = 104, className }: { size?: number; className?: string }) {
  return <LotusLogo size={size} className={cn("animate-logo-breathe", className)} />
}

/**
 * A full-surface loading state. `label` is read by assistive technology only; the
 * mark is the whole visible message, so nothing competes with it on screen.
 */
export function LogoLoader({ label, theme, size, className }: {
  label: string
  /** Pins the product theme for surfaces that render before the page's own theme is known. */
  theme?: "light" | "dark"
  size?: number
  className?: string
}) {
  return (
    <main
      role="status"
      {...(theme === undefined ? {} : { "data-product-theme": theme })}
      className={cn("flex min-h-svh items-center justify-center bg-background text-foreground", theme === "dark" && "dark", className)}
    >
      <LogoMark size={size} />
      <span className="sr-only">{label}</span>
    </main>
  )
}
