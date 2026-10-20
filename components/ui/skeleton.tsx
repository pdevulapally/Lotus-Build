import { cn } from "@/lib/utils"

/** Shimmering placeholder block; use instead of spinners while content loads. */
export const skeletonClass = "skeleton-shimmer rounded-md"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn(skeletonClass, className)} {...props} />
}
