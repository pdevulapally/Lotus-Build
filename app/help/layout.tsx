import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lotus-build.app"

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "How to plan software projects, implement changes, and review saved source files and versions. LotusBuild help and frequently asked questions.",
  openGraph: {
    title: "Help & FAQ | Lotus.build",
    description: "Learn how to build software with AI. FAQs, guides, and support.",
    url: `${siteUrl}/help`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Help & FAQ | Lotus.build",
    description: "Learn how to build software with AI.",
  },
  alternates: { canonical: `${siteUrl}/help` },
  robots: { index: true, follow: true },
}

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
