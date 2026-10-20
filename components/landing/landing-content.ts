import type { ComponentType, SVGProps } from 'react'
import type { TerminalEntry } from '@/lib/backend/terminal'
import {
  BlocksIcon, DesktopIcon, LockIcon, MailCodeIcon, PlanIcon, PreviewIcon, ShieldIcon,
  TeamAppIcon, TerminalIcon, ToolIcon, VersionsIcon, WebsiteIcon,
} from '@/components/ui/lotus-icons'

export type StartMode = 'plan' | 'build'
export type LandingIcon = ComponentType<SVGProps<SVGSVGElement>>

export type Brief = { label: string; mode: StartMode; prompt: string }
export type HeroCategory = { key: string; label: string; icon: LandingIcon; briefs: readonly Brief[] }

export const heroCategories = [
  {
    key: 'websites', label: 'Websites', icon: WebsiteIcon,
    briefs: [
      { label: 'Business website', mode: 'build', prompt: 'Help me build a website for my business. Ask about the business, its customers, and the pages it needs before proposing an approach.' },
      { label: 'Booking site', mode: 'build', prompt: 'Build a booking website for my salon with services, prices and an appointment calendar. Ask what you need to know first.' },
      { label: 'Launch page', mode: 'plan', prompt: 'Help me plan a launch page for a new product. Ask about the audience and the one action visitors should take.' },
    ],
  },
  {
    key: 'apps', label: 'Apps', icon: TeamAppIcon,
    briefs: [
      { label: 'App for my team', mode: 'build', prompt: 'Help me create an app for my team. Ask about our workflow, who will use it, and what it needs to do first.' },
      { label: 'Client portal', mode: 'plan', prompt: 'Help me plan a client portal where customers can see project progress, files and invoices. Ask about my clients first.' },
      { label: 'Inventory tracker', mode: 'build', prompt: 'Build an inventory tracker for a small shop: stock levels, low-stock alerts and a simple history. Ask what I sell first.' },
    ],
  },
  {
    key: 'tools', label: 'Internal tools', icon: ToolIcon,
    briefs: [
      { label: 'Approvals dashboard', mode: 'build', prompt: 'Build an internal tool where managers approve expense and leave requests. Ask about our approval rules first.' },
      { label: 'Onboarding checklist', mode: 'build', prompt: 'Build an onboarding checklist app for new starters with tasks, owners and due dates. Ask about our onboarding steps first.' },
      { label: 'Weekly report', mode: 'plan', prompt: 'Help me plan a reporting tool that turns our weekly numbers into one clear page. Ask where the numbers come from first.' },
    ],
  },
  {
    key: 'plans', label: 'Just planning', icon: PlanIcon,
    briefs: [
      { label: 'Plan an idea', mode: 'plan', prompt: 'Help me plan a software project. Ask about the problem, the users, and the requirements before proposing an approach.' },
      { label: 'Scope an MVP', mode: 'plan', prompt: 'Help me scope a first version of my product. Ask what matters most, then propose the smallest version worth launching.' },
      { label: 'Compare approaches', mode: 'plan', prompt: 'Help me compare two ways to build my idea. Ask about budget, timeline and who maintains it, then recommend one.' },
    ],
  },
] as const satisfies readonly HeroCategory[]

export type ShowcaseKind = 'bookings' | 'calendar' | 'invoice' | 'board' | 'stat' | 'storefront'
export type ShowcaseTile = { kind: ShowcaseKind; title: string; caption: string; tone: 'light' | 'dark' | 'soft'; mode: StartMode; prompt: string }

export const showcaseTiles = [
  { kind: 'stat', title: 'Bookings this week', caption: 'Salon dashboard', tone: 'dark', mode: 'build', prompt: 'Build a dashboard for my salon showing bookings, revenue and busiest days. Ask what I track today first.' },
  { kind: 'calendar', title: 'Pick a time', caption: 'Booking website', tone: 'light', mode: 'build', prompt: 'Build a booking website for my salon with services, prices and an appointment calendar. Ask what you need to know first.' },
  { kind: 'board', title: 'Approvals', caption: 'Internal tool', tone: 'soft', mode: 'build', prompt: 'Build an internal tool where managers approve expense and leave requests. Ask about our approval rules first.' },
  { kind: 'invoice', title: 'Invoice #1042', caption: 'Client portal', tone: 'light', mode: 'plan', prompt: 'Help me plan a client portal where customers can see project progress, files and invoices. Ask about my clients first.' },
  { kind: 'bookings', title: 'Stock levels', caption: 'Inventory tracker', tone: 'dark', mode: 'build', prompt: 'Build an inventory tracker for a small shop: stock levels, low-stock alerts and a simple history. Ask what I sell first.' },
  { kind: 'storefront', title: 'Fresh bread, daily', caption: 'Business website', tone: 'soft', mode: 'build', prompt: 'Help me build a website for my bakery. Ask about the shop, its customers, and the pages it needs before proposing an approach.' },
] as const satisfies readonly ShowcaseTile[]

export type DemoSceneKey = 'plan' | 'build' | 'preview'
export type DemoScene = { key: DemoSceneKey; step: string; detail: string; panel: 'preview' | 'terminal' }

export const demoSceneDurationMs = 5600
export const demoScenes = [
  { key: 'plan', step: 'Describe and plan', detail: 'LotusBuild asks before it builds.', panel: 'preview' },
  { key: 'build', step: 'Build', detail: 'Every command is visible as it runs.', panel: 'terminal' },
  { key: 'preview', step: 'Preview and refine', detail: 'Try it live, then keep going.', panel: 'preview' },
] as const satisfies readonly DemoScene[]

export const demoProject = {
  name: 'Salon booking website',
  projects: ['Salon booking website', 'Team onboarding app', 'Invoice tracker'],
  prompt: 'A booking website for my salon',
  question: 'Who will be booking appointments?',
  options: ['New clients', 'Regulars', 'Both'],
  selected: 'Both',
  buildSteps: [
    { title: 'Created the booking page', detail: 'Calendar, time slots and a confirmation step.' },
    { title: 'Added services and prices', detail: 'Cut, colour and treatments, editable later.' },
  ],
  runningStep: 'Setting up confirmation emails',
  commands: [
    { id: 'install', command: 'npm install', status: 'done', exitCode: 0, output: 'added 212 packages in 9s', at: '2026-01-01T00:00:00Z' },
    { id: 'dev', command: 'npm run dev', status: 'running', at: '2026-01-01T00:00:10Z' },
  ] satisfies readonly TerminalEntry[],
  previewHost: 'preview.lotusbuild.co.uk',
  previewServices: ['Cut & finish', 'Colour', 'Treatments'],
} as const

export type Capability = { icon: LandingIcon; label: string; detail: string }
export const capabilities = [
  { icon: PlanIcon, label: 'Plan mode', detail: 'Questions before code.' },
  { icon: BlocksIcon, label: 'Build mode', detail: 'Straight to a first version.' },
  { icon: PreviewIcon, label: 'Live preview', detail: 'Opens as soon as it is ready.' },
  { icon: TerminalIcon, label: 'Terminal', detail: 'Every command, in the open.' },
  { icon: DesktopIcon, label: 'Desktop view', detail: 'Watch when a build needs a screen.' },
  { icon: VersionsIcon, label: 'Versions', detail: 'Every change, saved.' },
] as const satisfies readonly Capability[]

export type FeatureRow = { title: string; copy: string }
export const featureRows = [
  { title: 'Asks before it builds', copy: 'A few plain questions up front, so the first version is the right one.' },
  { title: 'Shows its work as it goes', copy: 'Commands, output and screen activity appear in the workspace while it runs.' },
  { title: 'A live preview, not a promise', copy: 'Click through what was built the moment it is ready, from any device.' },
  { title: 'Every version kept', copy: 'Compare saved versions and see exactly what changed, line by line.' },
  { title: 'Real Git, not a black box', copy: 'Every project is a proper Git repository with a full commit history. GitHub connection is on the way.' },
  { title: 'Built for serious use', copy: 'Verified accounts, isolated previews and clear UK terms from day one.' },
] as const satisfies readonly FeatureRow[]

export type StartModeOption = { mode: StartMode; tag: string; title: string; copy: string; action: string }
export const startModes = [
  { mode: 'plan', tag: 'Plan', title: 'Talk it through first', copy: 'LotusBuild asks a few questions, then proposes a plan you can change before anything is built.', action: 'Start with a plan' },
  { mode: 'build', tag: 'Build', title: 'Go straight to building', copy: 'Describe what you want and watch it come together, then keep refining in the same conversation.', action: 'Start building' },
] as const satisfies readonly StartModeOption[]

export const savedWork = {
  files: [
    { name: 'app', depth: 0, folder: true, active: false },
    { name: 'booking', depth: 1, folder: true, active: false },
    { name: 'page.tsx', depth: 2, folder: false, active: true },
    { name: 'services.ts', depth: 1, folder: false, active: false },
    { name: 'layout.tsx', depth: 1, folder: false, active: false },
  ],
  code: [
    'import { Calendar } from "./calendar"',
    '',
    'export default function Booking() {',
    '  return (',
    '    <main>',
    '      <h1>Find your next appointment</h1>',
    '      <p>Pick a time that suits you.</p>',
    '      <Calendar />',
    '    </main>',
    '  )',
    '}',
  ],
  versions: [
    { label: 'Added confirmation emails', added: 42, removed: 6 },
    { label: 'Updated service prices', added: 8, removed: 8 },
    { label: 'First version', added: 316, removed: 0 },
  ],
  commits: [
    { hash: 'f3a9c1e', message: 'Add confirmation emails' },
    { hash: 'b71d4a0', message: 'Update service prices' },
    { hash: '2e8c0f9', message: 'First version of the booking site' },
  ],
} as const

export type TrustPoint = { icon: LandingIcon; title: string; copy: string }
export const trustPoints = [
  { icon: MailCodeIcon, title: 'Verified accounts', copy: 'Every email sign-up confirms a one-time code before it can open a workspace.' },
  { icon: LockIcon, title: 'Isolated previews', copy: 'Each build runs in its own sandbox, and previews are kept separate from your account.' },
  { icon: ShieldIcon, title: 'Clear UK terms', copy: 'Plain-English privacy and terms, written for how LotusBuild actually handles your data.' },
] as const satisfies readonly TrustPoint[]
