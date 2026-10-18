import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lotus-build.app"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare available LotusBuild plans, prices and included usage for your next project.",
  openGraph: {
    title: "Pricing | Lotus.build",
    description: "Compare available plans, prices and included usage for your next project.",
    url: `${siteUrl}/pricing`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Lotus.build",
    description: "Compare available plans, prices and included usage for your next project.",
  },
  alternates: { canonical: `${siteUrl}/pricing` },
  robots: { index: true, follow: true },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
