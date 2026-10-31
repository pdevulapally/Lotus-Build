"use client"
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { ChevronDown, History, Mic, Moon, SquarePen } from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'
import { LotusLogo } from '@/components/ui/lotus-logo'
import { SidebarToggleIcon } from '@/components/ui/sidebar-toggle-icon'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { TerminalPanel } from '@/components/computer/terminal-panel'
import { WorkspaceViewTabs } from '@/components/computer/workspace-panel'
import { ArrowUpIcon, ChevronUpDownIcon, CloseIcon, ExpandIcon, ExternalIcon, HomeIcon, RefreshIcon } from '@/components/ui/lotus-icons'
import { duration, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { demoProject, demoSceneDurationMs, demoScenes, type DemoSceneKey } from './landing-content'
import styles from './landing-demo.module.css'

const swap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: duration.base, ease },
}

const noop = () => {}

function StatusBadge({ scene }: { scene: DemoSceneKey }) {
  if (scene === 'build') {
    return <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success-soft-foreground"><span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-success" />Building</div>
  }
  if (scene === 'plan') {
    return <div className="flex items-center gap-1.5 rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground"><span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-foreground" />Planning</div>
  }
  return null
}

function FeedStep({ title, detail, running = false, delay = 0 }: { title: string; detail?: string; running?: boolean; delay?: number }) {
  return (
    <motion.div className={running ? 'py-2.5' : 'py-1'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: duration.base, ease }}>
      {running ? (
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/20" /><span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/50" /></span>
          <Shimmer className="text-[13.5px] font-semibold">{title}</Shimmer>
        </div>
      ) : <p className="text-[13.5px] font-semibold leading-snug text-foreground/80">{title}</p>}
      {detail && <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p>}
    </motion.div>
  )
}

function PlanTurn() {
  const badge = 'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border px-1 text-xs font-semibold'
  return <>
    <p className="text-[13px] leading-relaxed text-muted-foreground">Before I build, one quick question so the first version fits.</p>
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="space-y-2 px-3 py-2.5">
        <p className="text-sm font-semibold leading-snug tracking-[-0.02em] text-foreground">{demoProject.question}</p>
        <div className="space-y-1 pt-0.5">
          {demoProject.options.map((option, index) => {
            const checked = option === demoProject.selected
            return <div key={option} className="-mx-1 flex items-center gap-2 rounded-xl px-2.5 py-2">
              <span className={cn(badge, checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-muted/45 text-muted-foreground')}>{String.fromCharCode(65 + index)}</span>
              <span className="text-sm text-foreground">{option}</span>
            </div>
          })}
        </div>
        <div className="flex items-center justify-end gap-1.5 pt-0.5">
          <span className="h-6 rounded-lg px-2 text-xs leading-6 text-muted-foreground">Skip</span>
          <span className="h-6 rounded-lg bg-primary px-2.5 text-xs font-semibold leading-6 text-primary-foreground">Continue</span>
        </div>
      </div>
    </div>
  </>
}

function BuildTurn() {
  return <>
    <p className="text-[13px] leading-relaxed text-muted-foreground">Building the first version for new clients and regulars.</p>
    <div>
      {demoProject.buildSteps.map((step, index) => <FeedStep key={step.title} title={step.title} detail={step.detail} delay={0.2 + index * 0.5} />)}
      <FeedStep title={demoProject.runningStep} running delay={0.2 + demoProject.buildSteps.length * 0.5} />
    </div>
  </>
}

function PreviewTurn() {
  return <>
    <div>{demoProject.buildSteps.map((step) => <FeedStep key={step.title} title={step.title} />)}<FeedStep title="Started the preview" detail="Opened in the Preview tab." /></div>
    <p className="text-[13px] leading-relaxed text-muted-foreground">Your first version is ready to try. Click through it in Preview, then tell me what to change.</p>
  </>
}

const turns: Record<DemoSceneKey, () => React.JSX.Element> = { plan: PlanTurn, build: BuildTurn, preview: PreviewTurn }

function PreviewEmpty() {
  return <div className="flex h-full items-center justify-center p-6 text-center"><p className="text-[13px] text-muted-foreground">Preview appears here once the build starts.</p></div>
}

function PreviewSite() {
  return <div className="flex h-full flex-col">
    <div className="flex h-10 shrink-0 items-center justify-center border-b border-border/70 bg-muted/40 px-4">
      <div className="flex w-full max-w-sm items-center gap-0.5 overflow-hidden rounded-full border border-border bg-background px-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"><HomeIcon className="size-4" /></span>
        <span className="max-w-[130px] shrink truncate text-[11px] font-medium text-foreground/50">{demoProject.previewHost}</span>
        <span className="flex min-w-[40px] flex-1 items-center text-[12px] font-medium text-foreground"><span className="text-foreground/40">/</span>book</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"><ExternalIcon className="size-3.5" /></span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"><RefreshIcon className="size-4" /></span>
      </div>
    </div>
    <div className={styles.site} aria-hidden>
      <div className={styles.siteNav}><b /><span /><span /><span /><em>Book now</em></div>
      <strong>Find your next appointment</strong>
      <small>Pick a service and a time that suits you.</small>
      <div className={styles.siteServices}>{demoProject.previewServices.map((service) => <span key={service}>{service}</span>)}</div>
      <div className={styles.siteGrid}>{Array.from({ length: 14 }, (_, index) => <i key={index} data-selected={index === 9 || undefined} />)}</div>
      <i className={styles.siteButton}>Book Thu 11 · 2:30 pm</i>
    </div>
  </div>
}

function Composer({ mode }: { mode: 'Plan' | 'Build' }) {
  return (
    <div className="mx-auto mt-auto w-full max-w-[792px] shrink-0 pt-2">
      <div className="rounded-2xl border border-border bg-card px-3.5 pb-2.5 pt-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <p className="text-[13.5px] text-muted-foreground">Ask LotusBuild about this project…</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-foreground">{mode}<ChevronUpDownIcon className="size-3" /></span>
          <span className="flex items-center gap-2 text-muted-foreground"><Mic className="size-4" aria-hidden /><span className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground"><ArrowUpIcon className="size-4" /></span></span>
        </div>
      </div>
    </div>
  )
}

export function LandingDemo() {
  const reduceMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const inView = useInView(stageRef, { amount: 0.35 })
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const scene = demoScenes[index] ?? demoScenes[0]
  const autoplay = inView && !paused && !reduceMotion
  const Turn = turns[scene.key]

  useEffect(() => {
    if (!autoplay) return
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % demoScenes.length), demoSceneDurationMs)
    return () => window.clearTimeout(timer)
  }, [autoplay, index])

  return (
    <section id="workflow" className={styles.section} aria-labelledby="workflow-heading">
      <Reveal as="header" className={styles.header}>
        <p className={styles.eyebrow}>How it works</p>
        <h2 id="workflow-heading">One workspace. Watch it happen.</h2>
        <p className={styles.lead}>Describe what you need, answer a question or two, then watch the build run and the preview appear, all in one conversation.</p>
      </Reveal>

      <Reveal className={styles.stage} delay={0.1}>
        <div id="landing-product-demo" ref={stageRef} className={styles.window} role="img" aria-label="The LotusBuild workspace: project sidebar, conversation and a preview panel, shown as an illustrative demo">
          <div className={styles.browser}>
            <span className={styles.dots}><i /><i /><i /></span>
            <span className={styles.address}>lotusbuild.co.uk/computer/salon-booking</span>
          </div>
          <div className="flex min-h-0 flex-1 bg-background text-foreground">
            <aside className={cn(styles.rail, 'flex w-[256px] shrink-0 flex-col gap-2 border-r border-border/30 bg-muted/25')}>
              <header className="flex h-12 shrink-0 items-center justify-between px-2">
                <span className="p-1"><LotusLogo size={24} /></span>
                <span className="flex size-10 items-center justify-center text-muted-foreground"><SidebarToggleIcon className="size-[18px]" side="left" open /></span>
              </header>
              <span className="mx-2 flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-[13px]"><SquarePen className="size-4 shrink-0" aria-hidden />New project</span>
              <span className="mx-3 mt-5 flex min-h-9 items-center justify-between px-2 text-xs text-muted-foreground">Projects<ChevronDown className="size-3.5" aria-hidden /></span>
              <div className="min-h-0 flex-1 px-1">
                {demoProject.projects.map((project) => <div key={project} className="px-1"><span className={cn('flex min-h-9 w-full items-center rounded-lg px-3 py-1.5 text-[13px] leading-snug text-foreground', project === demoProject.name && 'bg-accent')}><span className="truncate">{project}</span></span></div>)}
              </div>
              <div className="mx-2 mb-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[13px]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">M</span>
                <span className="min-w-0 flex-1 truncate font-medium">Maya Okafor</span>
                <ChevronUpDownIcon className="size-3.5 text-muted-foreground" />
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-[52px] shrink-0 items-center bg-background">
                <div className="flex min-w-0 flex-1 items-center px-4">
                  <span className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5"><span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">{demoProject.name}</span><ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /></span>
                </div>
                <div className="flex h-full shrink-0 items-center justify-end gap-2 px-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={scene.key} {...swap} className="flex items-center"><StatusBadge scene={scene.key} /></motion.div>
                  </AnimatePresence>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg"><Moon className="h-3.5 w-3.5" aria-hidden /></span>
                    <span className="inline-flex size-9 items-center justify-center rounded-lg"><History className="h-3.5 w-3.5" aria-hidden /></span>
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-foreground"><SidebarToggleIcon className="size-[18px]" side="right" open /></span>
                  </div>
                </div>
              </header>
              <div className="flex min-h-0 flex-1">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4 pt-2 sm:px-6">
                  <div className="mx-auto flex w-full max-w-[792px] flex-col gap-4">
                    <div className="flex justify-end"><div className="max-w-full rounded-2xl bg-muted px-3.5 py-2.5 text-right text-[13.5px] leading-relaxed">{demoProject.prompt}</div></div>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={scene.key} className="flex flex-col gap-3" {...swap}><Turn /></motion.div>
                    </AnimatePresence>
                  </div>
                  <Composer mode={scene.key === 'plan' ? 'Plan' : 'Build'} />
                </div>

                <section className={cn(styles.panel, 'm-2 mt-0 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card')} aria-hidden>
                  <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
                    <WorkspaceViewTabs activeTab={scene.panel} onChange={noop} hasBrowser={false} hasResearch={false} hasDesktop={false} />
                    <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <span className="inline-flex size-8 items-center justify-center rounded-full"><ExpandIcon className="size-4" /></span>
                      <span className="inline-flex size-8 items-center justify-center rounded-full"><CloseIcon className="size-4" /></span>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1 bg-background">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={scene.key} className="absolute inset-0" {...swap}>
                        {scene.key === 'plan' && <PreviewEmpty />}
                        {scene.key === 'build' && <TerminalPanel entries={[...demoProject.commands]} />}
                        {scene.key === 'preview' && <PreviewSite />}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {!reduceMotion && <button type="button" className={styles.playback} aria-controls="landing-product-demo" onClick={() => setPaused((value) => !value)}>{paused ? 'Play demo' : 'Pause demo'}</button>}
    </section>
  )
}
