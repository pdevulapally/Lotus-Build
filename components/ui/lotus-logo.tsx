import type { CSSProperties } from 'react'

type Props = { petalColor?: string; size?: number; className?: string; style?: CSSProperties }

/** The supplied LotusBuild mark, without a renderer or a recreated flower. */
export function LotusLogo({ petalColor = 'currentColor', size = 32, className, style }: Props) {
  return <span aria-hidden="true" className={className} style={{ display: 'inline-block', width: size, height: size, flexShrink: 0,
    backgroundColor: petalColor, mask: 'url(/Images/lotusbuild-icon.svg) center / contain no-repeat',
    WebkitMask: 'url(/Images/lotusbuild-icon.svg) center / contain no-repeat', ...style }} />
}
