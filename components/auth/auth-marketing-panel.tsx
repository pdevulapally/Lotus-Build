import { BlocksIcon, PlanIcon, PreviewIcon, VersionsIcon } from "@/components/ui/lotus-icons"

const points = [
  { icon: PlanIcon, title: "Asks before it builds", description: "A few plain questions, then a plan you can change." },
  { icon: BlocksIcon, title: "Builds in front of you", description: "Every command and step visible while it runs." },
  { icon: PreviewIcon, title: "Live preview", description: "Click through what was built the moment it is ready." },
  { icon: VersionsIcon, title: "Every version kept", description: "Compare saved versions and see exactly what changed." },
]

export function AuthMarketingPanel() {
  return (
    <aside className="flex flex-col py-8 text-foreground" aria-labelledby="auth-workspace-title">
      <h2 id="auth-workspace-title" className="text-balance text-[clamp(44px,4.6vw,64px)] font-semibold leading-[1.02] tracking-[-0.055em]">
        Your next build<br />starts here.
      </h2>
      <p className="mt-6 max-w-md text-[16px] font-medium leading-relaxed text-muted-foreground">
        Describe a website, app or tool. LotusBuild plans it with you, builds it while you watch and keeps everything it makes.
      </p>
      <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-border pt-8">
        {points.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-[18px] shrink-0" />
            <div>
              <p className="text-[14px] font-semibold tracking-[-0.01em]">{title}</p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
