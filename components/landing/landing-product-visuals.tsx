import { CheckIcon, FilesIcon, GitBranchIcon } from '@/components/ui/lotus-icons'
import { demoProject, savedWork } from './landing-content'
import styles from './landing-product-visuals.module.css'

export function ProjectStoryVisual() {
  return <figure className={styles.story}>
    <figcaption className={styles.caption}>Illustrative project · {demoProject.name}</figcaption>
    <p className={styles.projectPrompt}>{demoProject.prompt}</p>
    <section className={styles.projectQuestion} aria-label="Example project conversation">
      <p>{demoProject.question}</p>
      <strong>{demoProject.selected}</strong>
    </section>
    <footer className={styles.projectArtifact}>
      <FilesIcon width={20} height={20} />
      <span><small>Saved to your project</small><code>{savedWork.path}</code></span>
    </footer>
  </figure>
}

export function BriefVisual() {
  return <figure className={styles.brief}>
    <figcaption className={styles.documentHeader}><span>Example brief</span><span>{demoProject.name}</span></figcaption>
    <p className={styles.briefQuestion}>{demoProject.question}</p>
    <ul className={styles.answers}>
      {demoProject.options.map((option) => <li key={option} data-selected={option === demoProject.selected || undefined}>
        <span className={styles.selection} aria-hidden>{option === demoProject.selected && <CheckIcon width={14} height={14} />}</span>
        <span>{option}</span>
      </li>)}
    </ul>
    <p className={styles.documentNote}>Illustrative planning question</p>
  </figure>
}

export function BookingVisual() {
  return <figure className={styles.booking}>
    <figcaption className={styles.documentHeader}><span>Example website</span><span>{demoProject.previewHost}</span></figcaption>
    <section className={styles.bookingBody} aria-label="Example salon booking page">
      <p className={styles.bookingTitle}>Find your next appointment</p>
      <p className={styles.bookingLead}>Pick a service and a time that suits you.</p>
      <ul className={styles.services}>{demoProject.previewServices.map((service) => <li key={service}><span>{service}</span><span className={styles.serviceMark} aria-hidden /></li>)}</ul>
    </section>
  </figure>
}

export function SourceVisual() {
  return <figure className={styles.source}>
    <figcaption className={styles.documentHeader}><span className={styles.sourcePath}><FilesIcon width={16} height={16} />{savedWork.path}</span><span>Example source</span></figcaption>
    <pre tabIndex={0} className={styles.sourceCode} aria-label="Example source code, scroll horizontally to read">
      <code>{savedWork.code.map((line, index) => <span key={index} className={styles.sourceLine}><span aria-hidden>{index + 1}</span>{line || '\u00a0'}</span>)}</code>
    </pre>
  </figure>
}

export function VersionsVisual() {
  return <figure className={styles.history}>
    <figcaption className={styles.documentHeader}><span>Example version history</span><span>{demoProject.name}</span></figcaption>
    <ol className={styles.versionList}>
      {savedWork.versions.map((version) => <li key={version.label}>
        <span className={styles.historyNode} aria-hidden />
        <p>{version.label}</p>
        <span className={styles.changeCount}><span>+{version.added}</span><span>−{version.removed}</span></span>
      </li>)}
    </ol>
  </figure>
}

export function GitVisual() {
  return <figure className={styles.git}>
    <figcaption className={styles.documentHeader}><span className={styles.sourcePath}><GitBranchIcon width={16} height={16} />Project history</span><span>Illustrative commits</span></figcaption>
    <ol className={styles.commitList}>
      {savedWork.commits.map((commit) => <li key={commit.hash}>
        <span className={styles.historyNode} aria-hidden />
        <code>{commit.hash}</code><p>{commit.message}</p>
      </li>)}
    </ol>
  </figure>
}
