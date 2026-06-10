"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Shield, AlertTriangle, ExternalLink, ChevronRight, ArrowUp, Info } from "lucide-react"
import { cn } from "@/lib/utils"

const EFFECTIVE_DATE = "12 May 2026"
const LAST_UPDATED   = "12 May 2026"

const TOC = [
  { id: "overview",          label: "Overview" },
  { id: "controller",        label: "Data Controller" },
  { id: "what-we-collect",   label: "Information We Collect" },
  { id: "how-we-use",        label: "How We Use Your Data" },
  { id: "legal-basis",       label: "Legal Basis (GDPR)" },
  { id: "sharing",           label: "Data Sharing" },
  { id: "retention",         label: "Data Retention" },
  { id: "your-rights",       label: "Your Rights" },
  { id: "international",     label: "International Transfers" },
  { id: "security",          label: "Security" },
  { id: "cookies",           label: "Cookies & Tracking" },
  { id: "ai-processing",     label: "AI Data Processing" },
  { id: "children",          label: "Children's Privacy" },
  { id: "california",        label: "California (CCPA)" },
  { id: "changes",           label: "Changes to Policy" },
  { id: "contact",           label: "Contact & Complaints" },
] as const

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0])
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const map = new Map<string, number>()
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const ob = new IntersectionObserver(
        ([entry]) => {
          map.set(id, entry.intersectionRatio)
          let best = ""
          let bestRatio = -1
          map.forEach((ratio, key) => {
            if (ratio > bestRatio) { bestRatio = ratio; best = key }
          })
          if (best) setActive(best)
        },
        { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
      )
      ob.observe(el)
      observers.push(ob)
    })
    return () => observers.forEach((ob) => ob.disconnect())
  }, [ids])
  return active
}

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top, behavior: "smooth" })
}

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="relative -top-24 invisible" aria-hidden />
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-5 text-xl font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-2 font-semibold text-zinc-800">{children}</p>
  )
}

function Callout({
  icon: Icon = Info,
  variant = "info",
  children,
}: {
  icon?: React.ElementType
  variant?: "info" | "warn"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "my-6 flex gap-3 rounded-xl border p-4 text-sm leading-relaxed",
        variant === "info"
          ? "border-border bg-info-soft text-info-soft-foreground"
          : "border-border bg-warning-soft text-warning-soft-foreground"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function DataTable({ rows }: { rows: { category: string; examples: string; purpose: string }[] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
            <th className="px-4 py-3 font-semibold text-zinc-700 w-1/4">Category</th>
            <th className="px-4 py-3 font-semibold text-zinc-700 w-2/5">Examples</th>
            <th className="px-4 py-3 font-semibold text-zinc-700">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.category} className={cn("border-b border-zinc-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-zinc-50/50")}>
              <td className="px-4 py-3 font-medium text-zinc-800 align-top">{row.category}</td>
              <td className="px-4 py-3 text-zinc-600 align-top">{row.examples}</td>
              <td className="px-4 py-3 text-zinc-600 align-top">{row.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RightCard({ right, desc }: { right: string; desc: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-800">{right}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
    </div>
  )
}

export default function PrivacyPage() {
  const sectionIds = TOC.map((t) => t.id)
  const active = useActiveSection(sectionIds)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowBack(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* â”€â”€ Hero header â”€â”€ */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
            <Shield className="h-3.5 w-3.5" />
            <span>Legal</span>
            <ChevronRight className="h-3 w-3" />
            <span>Privacy Policy</span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
            We take your privacy seriously. This policy explains what data we collect, why we
            collect it, and how we keep it safe â€” in plain language.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500">
            <span>
              <span className="font-medium text-zinc-700">Effective:</span> {EFFECTIVE_DATE}
            </span>
            <span className="hidden sm:inline text-zinc-300">|</span>
            <span>
              <span className="font-medium text-zinc-700">Last updated:</span> {LAST_UPDATED}
            </span>
            <span className="hidden sm:inline text-zinc-300">|</span>
            <Link href="/terms" className="inline-flex items-center gap-1 font-medium text-zinc-700 underline-offset-2 hover:underline">
              Terms of Service <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-info-soft px-4 py-2 text-xs text-info-soft-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            This policy covers GDPR (EU &amp; UK), CCPA (California), and global privacy requirements.
          </div>
        </div>
      </div>

      {/* â”€â”€ Main body â”€â”€ */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex gap-12 lg:gap-16">

          {/* â”€â”€ Sidebar â”€â”€ */}
          <aside className="hidden lg:block w-56 xl:w-64 shrink-0">
            <div className="sticky top-24">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                On this page
              </p>
              <nav className="space-y-0.5">
                {TOC.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollTo(id)}
                    className={cn(
                      "block w-full text-left rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active === id
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs font-semibold text-zinc-700">Data requests</p>
                <p className="mt-1 text-xs text-zinc-500">Exercise your rights or ask questions.</p>
                <a
                  href="mailto:arpkwebsitedevelopment@gmail.com"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                >
                  arpkwebsitedevelopment@gmail.com
                </a>
              </div>
            </div>
          </aside>

          {/* â”€â”€ Article â”€â”€ */}
          <article className="min-w-0 flex-1 text-sm leading-7 text-zinc-700">

            {/* 1. Overview */}
            <SectionAnchor id="overview" />
            <SectionTitle>1. Overview</SectionTitle>
            <p>
              This Privacy Policy explains how Lotus.build (&ldquo;Lotus.build&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, shares, and
              protects personal data when you use our website and services at{" "}
              <a href="https://lotus-build.vercel.app" className="font-medium text-foreground underline-offset-2 hover:underline">
                https://lotus-build.vercel.app
              </a>{" "}
              (the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-4">
              This policy applies to all users of the Service globally, including users in the
              European Economic Area (EEA), United Kingdom, and California. Where we are required
              to provide additional protections or rights under specific laws, we describe those in
              dedicated sections below.
            </p>
            <p className="mt-4">
              By using the Service, you acknowledge that you have read and understood this Privacy
              Policy. If you do not agree with our practices, please do not use the Service.
            </p>

            {/* 2. Controller */}
            <SectionAnchor id="controller" />
            <SectionTitle>2. Data Controller Information</SectionTitle>
            <p>
              For the purposes of the UK General Data Protection Regulation (UK GDPR) and the EU
              General Data Protection Regulation (EU GDPR), the data controller responsible for
              your personal data is:
            </p>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 space-y-1.5 text-sm">
              <p><span className="font-medium text-zinc-700">Organisation:</span> Lotus.build</p>
              <p>
                <span className="font-medium text-zinc-700">Website:</span>{" "}
                <a href="https://lotus-build.vercel.app" className="underline-offset-2 hover:underline">https://lotus-build.vercel.app</a>
              </p>
              <p>
                <span className="font-medium text-zinc-700">Contact:</span>{" "}
                <a href="mailto:arpkwebsitedevelopment@gmail.com" className="underline-offset-2 hover:underline">arpkwebsitedevelopment@gmail.com</a>
              </p>
            </div>
            <p className="mt-4">
              For all data protection enquiries, requests to exercise your rights, or complaints,
              please contact us at the email address above. We will respond to all requests within
              the timeframes required by applicable law (generally within 30 days).
            </p>

            {/* 3. What We Collect */}
            <SectionAnchor id="what-we-collect" />
            <SectionTitle>3. Information We Collect</SectionTitle>
            <p>
              We collect personal data in three main ways: information you provide to us directly,
              information collected automatically, and information from third-party services.
            </p>

            <SubTitle>3.1 Information You Provide Directly</SubTitle>
            <DataTable rows={[
              {
                category: "Account data",
                examples: "Name, email address, password (hashed), profile picture",
                purpose: "Account creation, authentication, and communication",
              },
              {
                category: "Billing data",
                examples: "Payment card details (processed by Stripe; we do not store raw card numbers), billing address, VAT number",
                purpose: "Processing subscriptions and purchases",
              },
              {
                category: "Prompts & content",
                examples: "Text prompts you submit, project names, custom instructions",
                purpose: "Generating websites and applications as instructed by you",
              },
              {
                category: "Support communications",
                examples: "Emails, in-app messages, feedback forms",
                purpose: "Providing customer support and improving the Service",
              },
              {
                category: "Team & workspace data",
                examples: "Team member email invitations, workspace names and settings",
                purpose: "Enabling collaboration features",
              },
            ]} />

            <SubTitle>3.2 Information Collected Automatically</SubTitle>
            <DataTable rows={[
              {
                category: "Usage data",
                examples: "Pages visited, features used, button clicks, session duration, error logs",
                purpose: "Improving the Service, debugging, and analytics",
              },
              {
                category: "Device & technical data",
                examples: "IP address, browser type and version, operating system, screen resolution, referrer URL",
                purpose: "Security, fraud prevention, and optimising compatibility",
              },
              {
                category: "Cookies & local storage",
                examples: "Session cookies, authentication tokens, preference cookies",
                purpose: "Authentication, preferences, and session management",
              },
              {
                category: "Log data",
                examples: "Server request logs including timestamp, IP address, and HTTP status codes",
                purpose: "Security monitoring, debugging, and service reliability",
              },
            ]} />

            <SubTitle>3.3 Information from Third-Party Services</SubTitle>
            <p className="mt-1">
              When you connect third-party accounts to Lotus.build, we receive data as authorised
              by you through those platforms&rsquo; OAuth or permission flows. This may include:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                "GitHub: repository access, profile information, and commit data (only the repositories you explicitly authorise)",
                "Supabase: project credentials, database credentials (stored encrypted)",
                "Google (Firebase Auth): email address, name, and profile picture if you sign in with Google",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* 4. How We Use */}
            <SectionAnchor id="how-we-use" />
            <SectionTitle>4. How We Use Your Data</SectionTitle>
            <p>We use the personal data we collect for the following purposes:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Providing, operating, and maintaining the Service, including processing your prompts through AI systems",
                "Creating and managing your account and authenticating your identity",
                "Processing payments and managing your subscription",
                "Personalising your experience and remembering your preferences",
                "Sending transactional communications such as account notifications, invoices, and security alerts",
                "Sending service and product updates where you have consented or where we have a legitimate interest",
                "Analysing usage to improve the Service and develop new features",
                "Detecting, investigating, and preventing fraudulent activity, abuse, and security incidents",
                "Complying with our legal obligations and enforcing our Terms of Service",
                "Responding to legal requests from authorities as required by law",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Callout variant="info" icon={Info}>
              We do <strong>not</strong> sell your personal data to third parties. We do not use
              your data for advertising profiling. Your prompts and generated content are not used
              to train AI models unless you have explicitly opted in to such use.
            </Callout>

            {/* 5. Legal Basis */}
            <SectionAnchor id="legal-basis" />
            <SectionTitle>5. Legal Basis for Processing (GDPR)</SectionTitle>
            <p>
              If you are located in the European Economic Area (EEA) or United Kingdom, we process
              your personal data on the following legal bases under Article 6 of the UK/EU GDPR:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  basis: "Contractual necessity",
                  desc: "Processing required to provide the Service you have signed up for, including account management, code generation, and billing.",
                },
                {
                  basis: "Legitimate interests",
                  desc: "Processing for security monitoring, fraud prevention, service improvement, and product analytics â€” where these interests are not overridden by your rights.",
                },
                {
                  basis: "Legal obligation",
                  desc: "Processing required to comply with applicable law, such as retaining financial records for tax purposes.",
                },
                {
                  basis: "Consent",
                  desc: "Processing for optional communications (marketing emails), certain cookies, and any use of your data for AI model training. You may withdraw consent at any time.",
                },
              ].map(({ basis, desc }) => (
                <div key={basis} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="font-semibold text-zinc-800">{basis}</p>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* 6. Sharing */}
            <SectionAnchor id="sharing" />
            <SectionTitle>6. Data Sharing &amp; Disclosure</SectionTitle>
            <p>
              We do not sell, rent, or trade your personal data. We share data only in the
              following limited circumstances:
            </p>
            <SubTitle>6.1 Service Providers (Data Processors)</SubTitle>
            <p className="mt-1">
              We use carefully selected third-party service providers who process data on our
              behalf under Data Processing Agreements:
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                    <th className="px-4 py-3 font-semibold text-zinc-700">Provider</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { p: "Google Firebase", purpose: "Authentication, database, hosting", loc: "USA (EU transfer safeguards)" },
                    { p: "OpenAI", purpose: "AI code & content generation", loc: "USA (EU transfer safeguards)" },
                    { p: "Anthropic", purpose: "AI code & content generation (Claude models)", loc: "USA (EU transfer safeguards)" },
                    { p: "Stripe", purpose: "Payment processing", loc: "USA (EU transfer safeguards)" },
                    { p: "E2B", purpose: "Sandboxed code execution", loc: "USA" },
                    { p: "Vercel", purpose: "Application hosting & CDN", loc: "USA/Global" },
                  ].map((row) => (
                    <tr key={row.p} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-800">{row.p}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.purpose}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SubTitle>6.2 Legal Disclosures</SubTitle>
            <p className="mt-1">
              We may disclose your personal data to law enforcement, government authorities, or
              other parties where required by applicable law, court order, or legal process, or
              where we believe disclosure is necessary to protect the rights, property, or safety of
              Lotus.build, our users, or the public.
            </p>
            <SubTitle>6.3 Business Transfers</SubTitle>
            <p className="mt-1">
              If Lotus.build is involved in a merger, acquisition, asset sale, or similar
              transaction, your personal data may be transferred as part of that transaction. We
              will notify you before your personal data is transferred and becomes subject to a
              different privacy policy.
            </p>

            {/* 7. Retention */}
            <SectionAnchor id="retention" />
            <SectionTitle>7. Data Retention</SectionTitle>
            <p>
              We retain personal data only for as long as necessary to fulfil the purposes set out
              in this policy and to comply with our legal obligations:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Account data: retained for the duration of your account and deleted within 90 days of account closure, unless longer retention is required by law",
                "Billing records: retained for 7 years to comply with financial and tax regulations in applicable jurisdictions",
                "Prompts and generated content: retained while your account is active and for up to 90 days after deletion, after which it is permanently removed",
                "Server logs: retained for up to 12 months for security and debugging purposes",
                "Support communications: retained for up to 3 years to enable us to resolve disputes and improve our service",
                "Anonymised analytics data: may be retained indefinitely as it cannot be used to identify you",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              When data is no longer required, we securely delete or anonymise it in accordance
              with industry best practices.
            </p>

            {/* 8. Rights */}
            <SectionAnchor id="your-rights" />
            <SectionTitle>8. Your Rights</SectionTitle>
            <p>
              Depending on your location, you have the following rights in relation to your
              personal data. To exercise any of these rights, contact us at{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>
              . We will respond within 30 days (or within the timeframe required by applicable law).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RightCard
                right="Right of Access"
                desc="Request a copy of the personal data we hold about you, along with information about how we use it."
              />
              <RightCard
                right="Right to Rectification"
                desc="Request that we correct inaccurate or incomplete personal data we hold about you."
              />
              <RightCard
                right="Right to Erasure"
                desc='Request that we delete your personal data ("right to be forgotten"), subject to certain legal exceptions.'
              />
              <RightCard
                right="Right to Data Portability"
                desc="Request a structured, machine-readable copy of the personal data you have provided to us."
              />
              <RightCard
                right="Right to Restrict Processing"
                desc="Request that we restrict how we process your data in certain circumstances."
              />
              <RightCard
                right="Right to Object"
                desc="Object to processing based on legitimate interests or for direct marketing purposes."
              />
              <RightCard
                right="Right to Withdraw Consent"
                desc="Withdraw any consent you have given at any time. Withdrawal does not affect prior lawful processing."
              />
              <RightCard
                right="Rights related to Automated Decisions"
                desc="Not be subject to decisions made solely through automated processing that significantly affect you."
              />
            </div>
            <p className="mt-4">
              We will not discriminate against you for exercising any of these rights. We may need
              to verify your identity before fulfilling a request.
            </p>

            {/* 9. International */}
            <SectionAnchor id="international" />
            <SectionTitle>9. International Data Transfers</SectionTitle>
            <p>
              Lotus.build is operated with infrastructure and service providers located primarily
              in the United States. If you are accessing the Service from the EEA, UK, or other
              regions with data protection laws, your personal data will be transferred to and
              processed in countries outside your jurisdiction, including the United States.
            </p>
            <p className="mt-4">
              For transfers from the EEA and UK, we rely on appropriate safeguards including:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                "Standard Contractual Clauses (SCCs) approved by the European Commission and the UK ICO",
                "Adequacy decisions where applicable",
                "Transfers to service providers certified under applicable frameworks",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              You may request a copy of the safeguards we use for international transfers by
              contacting us at{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>
              .
            </p>

            {/* 10. Security */}
            <SectionAnchor id="security" />
            <SectionTitle>10. Security</SectionTitle>
            <p>
              We implement technical and organisational security measures appropriate to the risk,
              including:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Encryption in transit using TLS 1.2 or higher for all data transfers",
                "Encryption at rest for sensitive data, including third-party credentials and environment variables",
                "Hashed passwords â€” we never store plaintext passwords",
                "Access controls limiting staff access to personal data on a need-to-know basis",
                "Sandboxed code execution environments to isolate user-generated code",
                "Regular security monitoring and logging",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              No system is completely secure. In the event of a data breach that affects your
              rights and freedoms, we will notify you and the relevant supervisory authority as
              required by applicable law (generally within 72 hours of becoming aware of the
              breach for regulatory notification, and without undue delay for affected individuals).
            </p>
            <p className="mt-4">
              If you discover a security vulnerability, please report it responsibly to{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>
              .
            </p>

            {/* 11. Cookies */}
            <SectionAnchor id="cookies" />
            <SectionTitle>11. Cookies &amp; Tracking Technologies</SectionTitle>
            <p>
              We use cookies and similar technologies to operate and improve the Service. Cookies
              are small text files stored on your device.
            </p>
            <SubTitle>Types of cookies we use</SubTitle>
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                    <th className="px-4 py-3 font-semibold text-zinc-700">Type</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: "Essential / Strictly necessary", purpose: "Authentication sessions, security tokens, CSRF protection. Required for the Service to function.", dur: "Session / up to 1 year" },
                    { type: "Functional / Preference", purpose: "Remembering your settings, theme preferences, and UI state.", dur: "Up to 1 year" },
                    { type: "Analytics", purpose: "Understanding how users navigate and use the Service to improve it.", dur: "Up to 2 years" },
                  ].map((row) => (
                    <tr key={row.type} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-800 align-top">{row.type}</td>
                      <td className="px-4 py-3 text-zinc-600 align-top">{row.purpose}</td>
                      <td className="px-4 py-3 text-zinc-600 align-top">{row.dur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              You can control cookies through your browser settings. Note that disabling essential
              cookies may prevent the Service from functioning correctly. For users in the EEA and
              UK, we obtain consent for non-essential cookies in accordance with applicable law.
            </p>

            {/* 12. AI Processing */}
            <SectionAnchor id="ai-processing" />
            <SectionTitle>12. AI Data Processing</SectionTitle>
            <Callout variant="info" icon={Info}>
              This section explains the specific privacy implications of our AI features.
            </Callout>
            <p>
              When you use Lotus.build&rsquo;s AI features, your prompts and related context are
              transmitted to AI providers (currently OpenAI and Anthropic) to generate responses.
              You should be aware of the following:
            </p>
            <ul className="mt-4 space-y-3 list-none pl-0">
              {[
                "Prompts you submit are sent to third-party AI providers to generate code and content. These providers process data in accordance with their own privacy policies and API usage agreements.",
                "We do not use your prompts or generated content to train our own AI models. Our AI providers also commit not to use API inputs for model training under their enterprise API terms.",
                "Avoid including sensitive personal data, passwords, private keys, or confidential business information in your prompts. If you do, that data will be transmitted to AI providers.",
                "AI-generated content is stored in our database while your project is active so we can provide the Service. You may delete your projects at any time.",
                "We store anonymised metadata about AI usage (such as token counts and latency) for billing and service improvement purposes.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* 13. Children */}
            <SectionAnchor id="children" />
            <SectionTitle>13. Children&rsquo;s Privacy</SectionTitle>
            <p>
              The Service is not directed to, and we do not knowingly collect personal data from,
              individuals under the age of 18. If you are a parent or guardian and believe your
              child has provided us with personal data without your consent, please contact us at{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>{" "}
              and we will promptly delete that data.
            </p>

            {/* 14. California */}
            <SectionAnchor id="california" />
            <SectionTitle>14. California Privacy Rights (CCPA / CPRA)</SectionTitle>
            <p>
              If you are a California resident, you have specific rights under the California
              Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA):
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RightCard
                right="Right to Know"
                desc="Request disclosure of the categories and specific pieces of personal information we collect, use, disclose, and sell."
              />
              <RightCard
                right="Right to Delete"
                desc="Request deletion of personal information we have collected about you, subject to certain exceptions."
              />
              <RightCard
                right="Right to Correct"
                desc="Request correction of inaccurate personal information we maintain about you."
              />
              <RightCard
                right="Right to Opt-Out of Sale/Sharing"
                desc="We do not sell or share your personal information for cross-context behavioural advertising. No opt-out is necessary."
              />
              <RightCard
                right="Right to Limit Use of Sensitive Data"
                desc="Request that we limit the use of sensitive personal information to specific permitted purposes."
              />
              <RightCard
                right="Right to Non-Discrimination"
                desc="We will not discriminate against you for exercising any of your CCPA rights."
              />
            </div>
            <p className="mt-4">
              To exercise your California rights, contact us at{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>
              . We will verify your identity before processing your request. You may also designate
              an authorised agent to submit requests on your behalf.
            </p>
            <p className="mt-4">
              <strong className="font-medium text-zinc-800">
                Categories of personal information collected in the past 12 months:
              </strong>{" "}
              Identifiers (email, IP address); commercial information (purchase history); internet
              activity (usage data); inferences drawn from usage. We have not sold or shared any
              personal information in the past 12 months.
            </p>

            {/* 15. Changes */}
            <SectionAnchor id="changes" />
            <SectionTitle>15. Changes to This Policy</SectionTitle>
            <p>
              We may update this Privacy Policy from time to time. We will post any changes on this
              page with an updated &ldquo;Last Updated&rdquo; date. For material changes, we will
              provide at least 30 days&rsquo; advance notice by email or prominent in-app
              notification where required by law.
            </p>
            <p className="mt-4">
              Your continued use of the Service after the effective date of a revised policy
              constitutes your acceptance of the changes. If you do not agree, please stop using
              the Service and delete your account.
            </p>

            {/* 16. Contact */}
            <SectionAnchor id="contact" />
            <SectionTitle>16. Contact &amp; Complaints</SectionTitle>
            <p>
              For any questions, concerns, or requests relating to your personal data or this
              Privacy Policy, please contact us:
            </p>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 space-y-2 text-sm">
              <p><span className="font-medium text-zinc-700">Email:</span>{" "}
                <a href="mailto:arpkwebsitedevelopment@gmail.com" className="text-foreground underline-offset-2 hover:underline">
                  arpkwebsitedevelopment@gmail.com
                </a>
              </p>
              <p><span className="font-medium text-zinc-700">Website:</span>{" "}
                <a href="https://lotus-build.vercel.app" target="_blank" rel="noopener noreferrer" className="text-foreground underline-offset-2 hover:underline">
                  https://lotus-build.vercel.app
                </a>
              </p>
            </div>

            <SubTitle>Complaints â€” EEA &amp; UK Users</SubTitle>
            <p className="mt-1">
              If you are located in the European Economic Area, you have the right to lodge a
              complaint with your local data protection supervisory authority. A list of EU
              supervisory authorities is available at{" "}
              <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">
                edpb.europa.eu
              </a>
              .
            </p>
            <p className="mt-4">
              If you are located in the United Kingdom, you may lodge a complaint with the
              Information Commissioner&rsquo;s Office (ICO) at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">
                ico.org.uk
              </a>
              . We would, however, appreciate the opportunity to address your concerns before you
              contact a regulator, so please reach out to us first.
            </p>

            {/* Divider */}
            <div className="mt-14 border-t border-zinc-200 pt-6 text-xs text-zinc-400 space-y-1">
              <p>This Privacy Policy was last updated on {LAST_UPDATED}.</p>
              <p>
                See also:{" "}
                <Link href="/terms" className="underline-offset-2 hover:underline hover:text-zinc-600">
                  Terms of Service
                </Link>
              </p>
            </div>
          </article>
        </div>
      </div>

      {/* â”€â”€ Back to top â”€â”€ */}
      {showBack && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-opacity hover:bg-accent/90"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      <FooterSection />
    </div>
  )
}

