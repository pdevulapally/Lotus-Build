import type { Metadata } from 'next'
// The callback address briefly carries a one-use code: never send it as a referrer, never index it.
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } }
export default function Layout({ children }: { children: React.ReactNode }) { return children }
