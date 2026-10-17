import styles from './brand-wordmark.module.css'

/** Original full wordmark supplied in the logo kit; CSS trims its export padding. */
export function BrandWordmark({ size = 'default' }: { size?: 'default' | 'compact' } = {}) {
  return <span className={`${styles.wordmark} ${size === 'compact' ? styles.compact : ''}`}><img src="/Images/lotusbuild-logokit.png" alt="LotusBuild" width={2172} height={724} /></span>
}
