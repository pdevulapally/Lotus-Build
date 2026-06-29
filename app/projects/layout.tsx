import type { Metadata } from "next"
import type { ReactNode } from "react"

import styles from "./layout.module.css"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lotus-build.app"

export const metadata: Metadata = {
  title: "My Projects",
  description: "Your Lotus.build projects. View, edit, and deploy your AI-built apps.",
  openGraph: {
    title: "My Projects | Lotus.build",
    description: "Your AI-built projects. View, edit, and deploy.",
    url: `${siteUrl}/projects`,
  },
  robots: { index: false, follow: true },
  alternates: { canonical: `${siteUrl}/projects` },
}

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>
}
