import { LotusLogo } from "@/components/ui/lotus-logo"

export const authInputClassName =
  "h-12 w-full rounded-full border border-border bg-muted/40 px-5 text-base font-medium text-foreground shadow-none outline-none transition-[border-color,box-shadow] placeholder:font-medium placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-foreground/8 motion-reduce:transition-none sm:text-[15px]"

export const authPrimaryButtonClassName =
  "h-12 w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground shadow-none transition-[opacity,transform] hover:bg-primary hover:opacity-90 active:scale-[0.99] motion-reduce:transition-none"

export const authGoogleButtonClassName =
  "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-card text-[15px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"

export const authLinkClassName =
  "rounded-sm font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export const authPasswordToggleClassName =
  "absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"

export const authLabelClassName = "text-[13.5px] font-semibold text-foreground"

export const authDividerClassName = "my-6 flex items-center gap-4 text-[12.5px] font-semibold text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"

export function AuthSpinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current/25 border-t-current motion-reduce:animate-none ${className}`}
    />
  )
}

export function GoogleMark() {
  return (
    <img
      src="/Images/google-icon-logo-svgrepo-com.svg"
      alt=""
      aria-hidden
      className="h-5 w-5 shrink-0"
    />
  )
}

export function AuthFormHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-10 text-center lg:mb-7 lg:text-left">
      <div className="mb-5 flex justify-center lg:hidden">
        <LotusLogo size={36} />
      </div>
      <h1 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-[36px]">
        {title}
      </h1>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-muted-foreground">{description}</p>
    </header>
  )
}
