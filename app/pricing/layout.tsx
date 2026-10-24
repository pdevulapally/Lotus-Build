import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lotus-build.app"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Billing transition information for the new LotusBuild workspace.",
  openGraph: {
    title: "Pricing | Lotus.build",
    description: "Billing is not connected to the new workspace yet.",
    url: `${siteUrl}/pricing`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Lotus.build",
    description: "Billing is not connected to the new workspace yet.",
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
