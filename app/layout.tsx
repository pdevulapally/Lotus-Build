import { Shimmer } from "@/components/ai-elements/shimmer"
import type React from "react"
import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthProvider } from "@/contexts/auth-context"
import { VerifiedEmailGate } from "@/components/auth/verified-email-gate"
import { SettingsDialogProvider } from "@/components/settings/settings-dialog"
import { ConsentAnalytics } from "@/components/consent-analytics"
import { MotionProvider } from "@/components/motion-provider"
import "./globals.css"
import "@fontsource-variable/manrope/index.css"

function normalizeSiteUrl(raw?: string): string {
  const value = (raw || "").trim()
  if (!value) return "https://lotus-build.app"
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL)

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LotusBuild | AI Software Workspace",
    template: "%s | Lotus.build",
  },
  description:
    "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
  keywords: ["AI software workspace", "software development", "AI coding", "LotusBuild"],
  authors: [{ name: "Lotus.build", url: siteUrl }],
  creator: "Lotus.build",
  publisher: "Lotus.build",
  applicationName: "Lotus.build",
  referrer: "origin-when-cross-origin",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Lotus.build",
    title: "LotusBuild | AI Software Workspace",
    description:
      "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
  },
  twitter: {
    card: "summary",
    title: "LotusBuild | AI Software Workspace",
    description: "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [{ url: "/Images/lotusbuild-icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
  verification: {
    // Optional: add when you have them
    // google: "google-site-verification-code",
    // yandex: "yandex-verification-code",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Lotus.build",
        url: siteUrl,
        logo: { "@type": "ImageObject", url: `${siteUrl}/Images/lotusbuild-icon.svg` },
        description: "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Lotus.build",
        description: "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        name: "Lotus.build",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: "Build software with LotusBuild. Plan your approach, implement changes, review source files and saved versions, and keep working in one project workspace.",
        url: siteUrl,
      },
    ],
  }

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground overflow-x-hidden">
        <MotionProvider>
          <AuthProvider>
            <SettingsDialogProvider>
              <Suspense fallback={<main className="grid min-h-svh place-items-center bg-background text-sm" role="status"><Shimmer as="p" className="font-medium">Checking your account…</Shimmer></main>}>
                <VerifiedEmailGate>{children}</VerifiedEmailGate>
              </Suspense>
            </SettingsDialogProvider>
          </AuthProvider>
          <ConsentAnalytics />
        </MotionProvider>
      </body>
    </html>
  )
}
