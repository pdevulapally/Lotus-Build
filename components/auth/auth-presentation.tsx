export const authInputClassName =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 motion-reduce:transition-none sm:text-sm"

export const authPrimaryButtonClassName =
  "h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary/90 motion-reduce:transition-none"

export const authGoogleButtonClassName =
  "flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"

export const authLinkClassName =
  "rounded-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export const authPasswordToggleClassName =
  "absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"

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
    <header className="mb-7">
      <p className="site-eyebrow mb-3">Your LotusBuild account</p>
      <h1 className="text-3xl font-semibold leading-tight tracking-[-0.045em] text-foreground sm:text-[2rem]">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </header>
  )
}
