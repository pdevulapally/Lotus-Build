import { ArrowRight, Check, Download, FileCode2, Folder, History } from 'lucide-react'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import styles from './landing-sections.module.css'

type StartMode = 'plan' | 'build'

const planQuestion = {
  prompt: 'A booking site for my salon',
  question: 'Who will be booking appointments?',
  options: ['New clients', 'Regulars', 'Both'],
  selected: 'Both',
}

const buildSteps = ['Booking page and calendar', 'Services and prices', 'Confirmation emails']

const startModes = [
  {
    mode: 'plan',
    tag: 'Plan',
    title: 'Talk it through first',
    copy: 'LotusBuild asks a few questions, then proposes a plan you can change before anything is built.',
    action: 'Start with a plan',
  },
  {
    mode: 'build',
    tag: 'Build',
    title: 'Go straight to building',
    copy: 'Describe what you want and watch it come together, then keep refining in the same conversation.',
    action: 'Start building',
  },
] as const satisfies ReadonlyArray<{ mode: StartMode; tag: string; title: string; copy: string; action: string }>

const files = [
  { name: 'app', depth: 0, folder: true },
  { name: 'booking', depth: 1, folder: true },
  { name: 'page.tsx', depth: 2, folder: false, active: true },
  { name: 'services.ts', depth: 1, folder: false },
  { name: 'layout.tsx', depth: 1, folder: false },
]

const codeLines = [
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
]

const versions = [
  { label: 'Added confirmation emails', added: 42, removed: 6 },
  { label: 'Updated service prices', added: 8, removed: 8 },
  { label: 'First version', added: 316, removed: 0 },
]

function PlanVisual() {
  return (
    <div className={styles.chat} aria-hidden>
      <p className={styles.userBubble}>{planQuestion.prompt}</p>
      <div className={styles.aiTurn}>
        <span className={styles.aiMark}>L</span>
        <div>
          <p>{planQuestion.question}</p>
          <div className={styles.options}>
            {planQuestion.options.map((option) => (
              <span key={option} data-selected={option === planQuestion.selected || undefined}>{option}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BuildVisual() {
  return (
    <div className={styles.build} aria-hidden>
      <span className={styles.buildName}>Salon booking website</span>
      <ul className={styles.steps}>
        {buildSteps.map((step) => (
          <li key={step}>
            <span className={styles.stepIcon}><Check size={12} strokeWidth={2.4} /></span>
            {step}
          </li>
        ))}
      </ul>
    </div>
  )
}

const visuals: Record<StartMode, () => React.JSX.Element> = { plan: PlanVisual, build: BuildVisual }

export function StartModesSection({ onChoose }: { onChoose: (mode: StartMode) => void }) {
  return (
    <section id="workflow" className={styles.section} aria-labelledby="workflow-heading">
      <Reveal as="header" className={styles.header}>
        <p className={styles.label}>Two ways to start</p>
        <h2 id="workflow-heading">Plan it with LotusBuild, or build right away.</h2>
        <p className={styles.intro}>Either way it’s one conversation and one project.</p>
      </Reveal>
      <RevealGroup className={styles.modes}>
        {startModes.map(({ mode, tag, title, copy, action }) => {
          const Visual = visuals[mode]
          return (
            <RevealItem as="article" key={mode} className={styles.modeCard}>
              <div className={styles.visual}>
                <Visual />
                <span className={styles.example}>Illustrative example</span>
              </div>
              <div className={styles.modeBody}>
                <span className={styles.tag}>{tag}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <button type="button" onClick={() => onChoose(mode)} className={styles.modeAction}>
                  {action}<ArrowRight size={16} aria-hidden />
                </button>
              </div>
            </RevealItem>
          )
        })}
      </RevealGroup>
    </section>
  )
}

export function SavedWorkSection() {
  return (
    <section id="saved-work" className={`${styles.section} ${styles.savedSection}`} aria-labelledby="saved-heading">
      <Reveal as="header" className={styles.header}>
        <p className={styles.label}>Your work, always yours</p>
        <h2 id="saved-heading">See the code. Track every change.</h2>
        <p className={styles.intro}>Everything LotusBuild makes is saved to your project, ready to inspect or take with you.</p>
      </Reveal>
      <RevealGroup className={styles.bento}>
        <RevealItem as="article" className={`${styles.tile} ${styles.codeTile}`}>
          <div className={styles.tileText}>
            <FileCode2 size={20} strokeWidth={1.6} aria-hidden />
            <h3>Read what was built</h3>
            <p>Browse every file and open the source right in your workspace.</p>
          </div>
          <div className={styles.editor} aria-label="Illustrative code example">
            <div className={styles.editorBar}>
              <span>booking / page.tsx</span>
              <span>Example source</span>
            </div>
            <div className={styles.editorBody}>
              <ul className={styles.tree} aria-hidden>
                {files.map((file) => (
                  <li key={file.name} style={{ paddingLeft: `${file.depth * 12 + 10}px` }} data-active={'active' in file || undefined}>
                    {file.folder ? <Folder size={13} /> : <FileCode2 size={13} />}{file.name}
                  </li>
                ))}
              </ul>
              <pre className={styles.code} tabIndex={0} aria-label="Example source code, scroll horizontally to read">
                <code>{codeLines.map((line, index) => <span className={styles.codeLine} key={index}><span aria-hidden>{index + 1}</span>{line || '\u00a0'}</span>)}</code>
              </pre>
            </div>
          </div>
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}>
            <History size={20} strokeWidth={1.6} aria-hidden />
            <h3>Follow every change</h3>
            <p>Compare saved versions and see exactly what changed.</p>
          </div>
          <ol className={styles.versions} aria-hidden>
            {versions.map((version) => (
              <li key={version.label}>
                <span>{version.label}</span>
                <span className={styles.diff}><em>+{version.added}</em><b>−{version.removed}</b></span>
              </li>
            ))}
          </ol>
          <span className={styles.exampleNote}>Illustrative version history</span>
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}>
            <Download size={20} strokeWidth={1.6} aria-hidden />
            <h3>Take it with you</h3>
            <p>Download your whole project as a ZIP whenever you like.</p>
          </div>
          <div className={styles.zip} aria-hidden>
            <span className={styles.zipIcon}><Download size={15} /></span>
            <span><strong>salon-booking.zip</strong><small>Full source code</small></span>
          </div>
          <span className={styles.exampleNote}>Example download</span>
        </RevealItem>
      </RevealGroup>
    </section>
  )
}
