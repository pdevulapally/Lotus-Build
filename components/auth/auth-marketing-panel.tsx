import { LotusLogo } from "@/components/ui/lotus-logo"
import { BlocksIcon, PlanIcon, PreviewIcon, VersionsIcon } from "@/components/ui/lotus-icons"

const points = [
  { icon: PlanIcon, title: "Asks before it builds", description: "A few plain questions, then a plan you can change." },
  { icon: BlocksIcon, title: "Builds in front of you", description: "Every command and step visible while it runs." },
  { icon: PreviewIcon, title: "Live preview", description: "Click through what was built the moment it is ready." },
  { icon: VersionsIcon, title: "Every version kept", description: "Compare saved versions and see exactly what changed." },
]

export function AuthMarketingPanel() {
  return (
    <aside className="flex h-full min-h-[640px] flex-col rounded-[28px] bg-foreground p-10 text-background" aria-labelledby="auth-workspace-title">
      <div className="flex items-center gap-3">
        <LotusLogo size={28} className="text-background" />
        <span className="text-[12.5px] font-bold uppercase tracking-[0.04em] opacity-70">Your AI software workspace</span>
      </div>
      <h2 id="auth-workspace-title" className="mt-auto text-balance text-[clamp(40px,4.2vw,58px)] font-bold leading-[0.98] tracking-[-0.055em]">
        Your next build<br />starts here.
      </h2>
      <p className="mt-6 max-w-sm text-[16px] font-medium leading-relaxed opacity-75">
        Describe a website, app or tool. LotusBuild plans it with you, builds it while you watch and keeps everything it makes.
      </p>
      <ul className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-background/15 pt-8">
        {points.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-[18px] shrink-0" />
            <div>
              <p className="text-[14px] font-bold tracking-[-0.01em]">{title}</p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed opacity-70">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
