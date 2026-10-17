import styles from './brand-wordmark.module.css'

/** Original full wordmark supplied in the logo kit; CSS trims its export padding. */
export function BrandWordmark({ size = 'default' }: { size?: 'default' | 'compact' | 'nav' } = {}) {
  const sizeClass = size === 'compact' ? styles.compact : size === 'nav' ? styles.nav : ''
  return <span className={`${styles.wordmark} ${sizeClass}`}><img src="/Images/lotusbuild-logokit.png" alt="LotusBuild" width={2172} height={724} /></span>
}
