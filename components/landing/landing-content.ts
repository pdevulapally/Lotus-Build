import type { ComponentType, SVGProps } from 'react'
import type { TerminalEntry } from '@/lib/backend/terminal'
import {
  AppIcon, LockIcon, MailCodeIcon, PlanIcon, ShieldIcon, WebsiteIcon, WorkflowIcon,
} from '@/components/ui/lotus-icons'

export type StartMode = 'plan' | 'build'
export type LandingIcon = ComponentType<SVGProps<SVGSVGElement>>

export type Brief = { label: string; mode: StartMode; prompt: string }
export type HeroCategory = Brief & { key: string; icon: LandingIcon }

export const heroCategories = [
  { key: 'websites', label: 'Websites', icon: WebsiteIcon, mode: 'build', prompt: 'Help me build a website for my business. Ask about the business, its customers, and the pages it needs before proposing an approach.' },
  { key: 'apps', label: 'Apps', icon: AppIcon, mode: 'build', prompt: 'Help me create an app for my team. Ask about our workflow, who will use it, and what it needs to do first.' },
  { key: 'tools', label: 'Internal tools', icon: WorkflowIcon, mode: 'build', prompt: 'Help me build an internal tool for my team. Ask about the process it should replace and who will use it first.' },
  { key: 'plans', label: 'Just planning', icon: PlanIcon, mode: 'plan', prompt: 'Help me plan a software project. Ask about the problem, the users, and the requirements before proposing an approach.' },
] as const satisfies readonly HeroCategory[]

export type HeroCategoryKey = (typeof heroCategories)[number]['key']

export type ShowcaseKind = 'bookings' | 'calendar' | 'invoice' | 'board' | 'stat' | 'storefront'
export type ShowcaseTile = { kind: ShowcaseKind; category: HeroCategoryKey; title: string; caption: string; tone: 'light' | 'dark' | 'soft'; mode: StartMode; prompt: string }

export const showcaseTiles = [
  { kind: 'stat', category: 'apps', title: 'Bookings this week', caption: 'Salon dashboard', tone: 'dark', mode: 'build', prompt: 'Build a dashboard for my salon showing bookings, revenue and busiest days. Ask what I track today first.' },
  { kind: 'calendar', category: 'websites', title: 'Pick a time', caption: 'Booking website', tone: 'light', mode: 'build', prompt: 'Build a booking website for my salon with services, prices and an appointment calendar. Ask what you need to know first.' },
  { kind: 'board', category: 'tools', title: 'Approvals', caption: 'Internal tool', tone: 'soft', mode: 'build', prompt: 'Build an internal tool where managers approve expense and leave requests. Ask about our approval rules first.' },
  { kind: 'invoice', category: 'plans', title: 'Invoice #1042', caption: 'Client portal', tone: 'light', mode: 'plan', prompt: 'Help me plan a client portal where customers can see project progress, files and invoices. Ask about my clients first.' },
  { kind: 'bookings', category: 'apps', title: 'Stock levels', caption: 'Inventory tracker', tone: 'dark', mode: 'build', prompt: 'Build an inventory tracker for a small shop: stock levels, low-stock alerts and a simple history. Ask what I sell first.' },
  { kind: 'storefront', category: 'websites', title: 'Fresh bread, daily', caption: 'Business website', tone: 'soft', mode: 'build', prompt: 'Help me build a website for my bakery. Ask about the shop, its customers, and the pages it needs before proposing an approach.' },
] as const satisfies readonly ShowcaseTile[]

export type DemoSceneKey = 'plan' | 'build' | 'preview'
export type DemoScene = { key: DemoSceneKey; panel: 'preview' | 'terminal' }

export const demoSceneDurationMs = 5600
export const demoScenes = [
  { key: 'plan', panel: 'preview' },
  { key: 'build', panel: 'terminal' },
  { key: 'preview', panel: 'preview' },
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

export type StartModeOption = { mode: StartMode; tag: string; title: string; copy: string; action: string }
export const startModes = [
  { mode: 'plan', tag: 'Plan', title: 'Talk it through first', copy: 'LotusBuild asks a few questions, then proposes a plan you can change before anything is built.', action: 'Start with a plan' },
  { mode: 'build', tag: 'Build', title: 'Go straight to building', copy: 'Describe what you want and watch it come together, then keep refining in the same conversation.', action: 'Start building' },
] as const satisfies readonly StartModeOption[]

export const savedWork = {
  path: 'app/booking/page.tsx',
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

export type TrustPoint = { icon: LandingIcon; title: string; copy: string; href: string; linkLabel: string }
export const trustPoints = [
  { icon: MailCodeIcon, title: 'Verified accounts', copy: 'Every email sign-up confirms a one-time code before it can open a workspace.', href: '/help', linkLabel: 'Account help' },
  { icon: LockIcon, title: 'Isolated previews', copy: 'Each build runs in its own sandbox, and previews are kept separate from your account.', href: '/privacy#security', linkLabel: 'Privacy and security' },
  { icon: ShieldIcon, title: 'Clear UK terms', copy: 'Plain-English privacy and terms, written for how LotusBuild actually handles your data.', href: '/terms', linkLabel: 'Read the terms' },
] as const satisfies readonly TrustPoint[]
