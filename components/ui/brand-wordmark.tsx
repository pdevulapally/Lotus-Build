import styles from './brand-wordmark.module.css'

/** Original full wordmark supplied in the logo kit; CSS trims its export padding. */
export function BrandWordmark() {
  return <span className={styles.wordmark}><img src="/Images/lotusbuild-logokit.png" alt="LotusBuild" width={2172} height={724} /></span>
}
