"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Scale, AlertTriangle, ExternalLink, ChevronRight, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const EFFECTIVE_DATE = "12 May 2026"
const LAST_UPDATED   = "12 May 2026"

const TOC = [
  { id: "acceptance",        label: "Acceptance of Terms" },
  { id: "services",          label: "Description of Services" },
  { id: "eligibility",       label: "Eligibility" },
  { id: "accounts",          label: "User Accounts" },
  { id: "billing",           label: "Billing & Subscriptions" },
  { id: "ai-content",        label: "AI-Generated Content" },
  { id: "ip",                label: "Intellectual Property" },
  { id: "acceptable-use",    label: "Acceptable Use" },
  { id: "third-party",       label: "Third-Party Services" },
  { id: "data",              label: "Data & Privacy" },
  { id: "security",          label: "Security" },
  { id: "disclaimers",       label: "Disclaimers" },
  { id: "liability",         label: "Limitation of Liability" },
  { id: "indemnification",   label: "Indemnification" },
  { id: "termination",       label: "Termination" },
  { id: "governing-law",     label: "Governing Law" },
  { id: "changes",           label: "Changes to Terms" },
  { id: "contact",           label: "Contact Us" },
] as const

type SectionId = (typeof TOC)[number]["id"]

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

function Callout({
  icon: Icon = AlertTriangle,
  variant = "warn",
  children,
}: {
  icon?: React.ElementType
  variant?: "warn" | "info"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "my-6 flex gap-3 rounded-xl border p-4 text-sm leading-relaxed",
        variant === "warn"
          ? "border-border bg-warning-soft text-warning-soft-foreground"
          : "border-border bg-info-soft text-info-soft-foreground"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export default function TermsPage() {
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
            <Scale className="h-3.5 w-3.5" />
            <span>Legal</span>
            <ChevronRight className="h-3 w-3" />
            <span>Terms of Service</span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
            Please read these terms carefully before using Lotus.build. By accessing or using our
            service you agree to be bound by these terms.
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
            <Link href="/privacy" className="inline-flex items-center gap-1 font-medium text-zinc-700 underline-offset-2 hover:underline">
              Privacy Policy <ExternalLink className="h-3 w-3" />
            </Link>
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
                <p className="text-xs font-semibold text-zinc-700">Questions?</p>
                <p className="mt-1 text-xs text-zinc-500">Our team is happy to help.</p>
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

            {/* 1. Acceptance */}
            <SectionAnchor id="acceptance" />
            <SectionTitle>1. Acceptance of Terms</SectionTitle>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement
              between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo;) and
              Lotus.build (&ldquo;Lotus.build&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
              &ldquo;our&rdquo;), the operator of the website located at{" "}
              <a href="https://lotus-build.vercel.app" className="font-medium text-foreground underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
                https://lotus-build.vercel.app
              </a>{" "}
              and all associated services, APIs, and tools (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-4">
              By creating an account, clicking &ldquo;I agree&rdquo;, or otherwise accessing or
              using the Service, you acknowledge that you have read, understood, and agree to be
              bound by these Terms and our{" "}
              <Link href="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated herein by reference. If you do not agree to these Terms, you
              must not access or use the Service.
            </p>
            <p className="mt-4">
              If you are using the Service on behalf of an organisation, you represent and warrant
              that you have authority to bind that organisation to these Terms, and references to
              &ldquo;you&rdquo; include both you individually and that organisation.
            </p>

            {/* 2. Services */}
            <SectionAnchor id="services" />
            <SectionTitle>2. Description of Services</SectionTitle>
            <p>
              Lotus.build is an AI-powered web application builder that enables users to generate,
              iterate, and deploy production-ready websites and web applications using natural
              language prompts. The Service includes, but is not limited to:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "AI-assisted code generation for websites, landing pages, dashboards, and web applications",
                "Live preview and sandboxed execution environments for generated code",
                "Integration with third-party services including Supabase (database), GitHub (version control), Netlify and Vercel (deployment), and Stripe (payments)",
                "A computer-agent feature that autonomously plans and builds multi-page applications",
                "Team workspaces, project management, and collaboration tools",
                "API access for programmatic interaction with Lotus.build capabilities",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              We reserve the right to modify, suspend, or discontinue any aspect of the Service at
              any time, with or without notice. We will endeavour to provide reasonable advance
              notice of material changes where practicable.
            </p>

            {/* 3. Eligibility */}
            <SectionAnchor id="eligibility" />
            <SectionTitle>3. Eligibility</SectionTitle>
            <p>To use the Service, you must:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Be at least 18 years of age, or the age of legal majority in your jurisdiction if higher",
                "Have the legal capacity to enter into a binding contract",
                "Not be prohibited from using the Service under applicable law, including applicable export control or sanctions laws",
                "Not be located in a country subject to a United Kingdom, European Union, or United States government embargo",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              The Service is not directed to individuals under the age of 18. If we become aware
              that a user is under 18, we will terminate that account immediately.
            </p>

            {/* 4. Accounts */}
            <SectionAnchor id="accounts" />
            <SectionTitle>4. User Accounts</SectionTitle>
            <p>
              To access most features of the Service, you must register for an account. When
              registering, you agree to:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Provide accurate, current, and complete information about yourself",
                "Maintain and promptly update your account information to keep it accurate",
                "Keep your password and API keys confidential and secure",
                "Accept responsibility for all activities that occur under your account",
                "Notify us immediately at arpkwebsitedevelopment@gmail.com if you suspect any unauthorised access to your account",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              You may not share your account credentials with any third party, create accounts by
              automated means, or misrepresent your identity or affiliation. We reserve the right
              to refuse service, terminate accounts, or remove content at our sole discretion.
            </p>

            {/* 5. Billing */}
            <SectionAnchor id="billing" />
            <SectionTitle>5. Billing &amp; Subscriptions</SectionTitle>
            <p>
              Certain features of the Service require a paid subscription or the purchase of usage
              credits (&ldquo;Tokens&rdquo;). All billing is processed through Stripe, Inc., our
              third-party payment processor. By providing payment information, you authorise us to
              charge you for the applicable fees.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Pricing</p>
            <p className="mt-2">
              Current pricing is available at{" "}
              <Link href="/pricing" className="font-medium text-foreground underline-offset-2 hover:underline">
                https://lotus-build.vercel.app/pricing
              </Link>
              . All prices are displayed exclusive of applicable taxes unless stated otherwise.
              You are responsible for any value-added tax (VAT), goods and services tax (GST), or
              other applicable taxes in your jurisdiction.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Subscriptions</p>
            <p className="mt-2">
              Subscriptions are billed on a recurring basis (monthly or annually) as selected at
              the time of purchase. Your subscription will automatically renew at the end of each
              billing period unless you cancel it before the renewal date. You can cancel your
              subscription at any time through your account settings.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Refunds</p>
            <p className="mt-2">
              Token purchases and subscription fees are generally non-refundable. If you believe
              you have been charged in error or wish to request a refund, please contact{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>{" "}
              within 14 days of the charge. Refund eligibility is assessed on a case-by-case basis
              at our sole discretion. For users in the European Union and United Kingdom, your
              statutory consumer rights are not affected.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Price Changes</p>
            <p className="mt-2">
              We reserve the right to change our pricing at any time. For existing subscribers, we
              will provide at least 30 days&rsquo; notice before any price change takes effect. Your
              continued use of the Service after the effective date constitutes acceptance of the
              new pricing.
            </p>

            {/* 6. AI-Generated Content */}
            <SectionAnchor id="ai-content" />
            <SectionTitle>6. AI-Generated Content</SectionTitle>
            <Callout icon={AlertTriangle} variant="warn">
              <strong>Important â€” AI Limitations:</strong> The AI systems powering Lotus.build
              are sophisticated but not infallible. Generated code, content, designs, and
              recommendations may contain errors, omissions, security vulnerabilities, outdated
              practices, or inaccuracies. You are solely responsible for reviewing, testing, and
              validating all AI-generated output before use in any production environment.
            </Callout>
            <p>
              Lotus.build uses large language models provided by third-party AI providers including
              OpenAI and Anthropic to generate code and content. You acknowledge and agree that:
            </p>
            <ul className="mt-4 space-y-3 list-none pl-0">
              {[
                "AI-generated output may be factually incorrect, legally non-compliant, or technically flawed. We make no guarantee as to the accuracy, completeness, reliability, or fitness for purpose of any AI-generated content.",
                "AI-generated code may contain security vulnerabilities. You are responsible for conducting your own security review before deploying any generated code to production systems.",
                "The AI may reproduce patterns or code from its training data that are subject to third-party intellectual property rights. You are solely responsible for ensuring that your use of AI-generated output does not infringe upon third-party rights.",
                "Results may vary between prompts even when inputs appear similar. The AI is probabilistic, not deterministic.",
                "You should not rely on AI-generated legal, financial, medical, or safety-critical content without independent professional verification.",
                "AI providers may update or change their underlying models, which may affect the quality or characteristics of generated output.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              We are not liable for any loss, damage, or harm arising from your reliance on or use
              of AI-generated output, including but not limited to any errors in generated code,
              data loss, security breaches, or business losses.
            </p>

            {/* 7. IP */}
            <SectionAnchor id="ip" />
            <SectionTitle>7. Intellectual Property</SectionTitle>
            <p className="font-medium text-zinc-800">Our Intellectual Property</p>
            <p className="mt-2">
              The Service and its original content (excluding user-provided content and AI-generated
              output), features, functionality, branding, trademarks, logos, and software are and
              will remain the exclusive property of Lotus.build and its licensors. You may not copy,
              modify, distribute, sell, or lease any part of the Service or its underlying
              technology without our express written permission.
            </p>
            <p className="mt-4 font-medium text-zinc-800">User Content</p>
            <p className="mt-2">
              You retain all rights to the content, data, and materials you upload or input into
              the Service (&ldquo;User Content&rdquo;). By submitting User Content, you grant
              Lotus.build a non-exclusive, worldwide, royalty-free licence to use, process, store,
              and transmit your User Content solely to the extent necessary to provide the Service
              to you.
            </p>
            <p className="mt-4 font-medium text-zinc-800">AI-Generated Output</p>
            <p className="mt-2">
              Subject to these Terms and applicable law, you own the code, designs, and other
              content generated by the Service in response to your prompts (&ldquo;Generated
              Output&rdquo;). However, because AI output is derived from models trained on broad
              datasets, we cannot guarantee that Generated Output is free from third-party
              intellectual property claims. You accept sole responsibility for any IP issues
              arising from your use of Generated Output.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Feedback</p>
            <p className="mt-2">
              If you provide us with feedback, suggestions, or ideas about the Service
              (&ldquo;Feedback&rdquo;), you grant us an irrevocable, perpetual, worldwide,
              royalty-free right to use that Feedback for any purpose without compensation to you.
            </p>

            {/* 8. Acceptable Use */}
            <SectionAnchor id="acceptable-use" />
            <SectionTitle>8. Acceptable Use Policy</SectionTitle>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these
              Terms. You must not use the Service to:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Generate, distribute, or promote illegal content, including but not limited to content that is defamatory, obscene, fraudulent, or in violation of any person's privacy rights",
                "Infringe any third party's intellectual property, privacy, or other rights",
                "Violate any applicable local, national, or international law or regulation",
                "Generate malicious code, malware, spyware, phishing pages, or any software designed to harm systems or deceive users",
                "Conduct automated queries or scraping beyond what is permitted by our API documentation",
                "Attempt to gain unauthorised access to any part of the Service, other accounts, or related systems",
                "Use the Service to build tools that themselves violate these Terms or applicable law",
                "Transmit unsolicited commercial communications (spam)",
                "Impersonate any person or entity or misrepresent your affiliation with any person or entity",
                "Use the Service in any manner that could disable, overburden, damage, or impair it, or interfere with any other party's use of the Service",
                "Generate content that promotes discrimination, hatred, or violence based on protected characteristics",
                "Use the Service in any application where AI errors could cause death, personal injury, or catastrophic damage without appropriate human oversight",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              We reserve the right to investigate any suspected violation of this policy and to
              take appropriate action, including suspending or terminating your account, reporting
              to law enforcement, and seeking legal remedies.
            </p>

            {/* 9. Third-Party */}
            <SectionAnchor id="third-party" />
            <SectionTitle>9. Third-Party Services &amp; Integrations</SectionTitle>
            <p>
              The Service integrates with and relies upon various third-party platforms and services,
              including:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { name: "OpenAI & Anthropic", desc: "AI model providers powering code generation and agent features" },
                { name: "Firebase / Google Cloud", desc: "Authentication, database, and infrastructure" },
                { name: "Stripe", desc: "Payment processing and subscription management" },
                { name: "GitHub", desc: "Version control and code repository integration" },
                { name: "Supabase", desc: "Database provisioning and backend integration" },
                { name: "Vercel & Netlify", desc: "Application deployment and hosting" },
                { name: "E2B", desc: "Sandboxed code execution environments" },
              ].map(({ name, desc }) => (
                <div key={name} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-sm font-medium text-zinc-800">{name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4">
              Your use of third-party services is subject to their respective terms of service and
              privacy policies. We are not responsible for the availability, accuracy, content,
              products, or services of third-party services. Links to third-party websites do not
              imply endorsement.
            </p>
            <p className="mt-4">
              When you connect third-party accounts (such as GitHub or Supabase) to Lotus.build,
              you authorise us to access and use information from those accounts as required to
              provide the Service, in accordance with the permissions you grant through those
              platforms&rsquo; OAuth or authorisation flows.
            </p>

            {/* 10. Data */}
            <SectionAnchor id="data" />
            <SectionTitle>10. Data &amp; Privacy</SectionTitle>
            <p>
              Your privacy is important to us. Our{" "}
              <Link href="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
                Privacy Policy
              </Link>{" "}
              describes how we collect, use, store, and share your personal data, and forms part of
              these Terms. By using the Service, you consent to the processing of your data as
              described in our Privacy Policy.
            </p>
            <p className="mt-4">
              If you are located in the European Economic Area (EEA), United Kingdom, or
              Switzerland, your data may be transferred to and processed in countries outside your
              jurisdiction, including the United States. Such transfers are made in accordance with
              applicable data protection laws, including through Standard Contractual Clauses
              where required. Please see our Privacy Policy for full details.
            </p>
            <p className="mt-4">
              You are responsible for ensuring that any personal data of third parties that you
              upload or process through the Service is handled in compliance with applicable data
              protection laws, including obtaining any necessary consents.
            </p>

            {/* 11. Security */}
            <SectionAnchor id="security" />
            <SectionTitle>11. Security</SectionTitle>
            <p>
              We implement reasonable technical and organisational security measures to protect
              your data and the Service. However, no method of transmission over the internet or
              electronic storage is 100% secure.
            </p>
            <p className="mt-4">
              You are responsible for maintaining the security of your account credentials, API
              keys, and any third-party tokens you store or connect via the Service. You must
              not embed credentials directly in generated code that is shared publicly or deployed
              to publicly accessible repositories.
            </p>
            <p className="mt-4">
              If you discover a security vulnerability in the Service, please report it
              responsibly to{" "}
              <a href="mailto:arpkwebsitedevelopment@gmail.com" className="font-medium text-foreground underline-offset-2 hover:underline">
                arpkwebsitedevelopment@gmail.com
              </a>{" "}
              before disclosing it publicly. We appreciate responsible disclosure.
            </p>

            {/* 12. Disclaimers */}
            <SectionAnchor id="disclaimers" />
            <SectionTitle>12. Disclaimers of Warranties</SectionTitle>
            <Callout variant="warn">
              <strong>Important:</strong> The Service is provided on an &ldquo;as is&rdquo; and
              &ldquo;as available&rdquo; basis. To the fullest extent permitted by applicable law,
              Lotus.build expressly disclaims all warranties of any kind, whether express, implied,
              or statutory.
            </Callout>
            <p>
              Without limiting the foregoing, Lotus.build makes no warranty that:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "The Service will meet your requirements or be available on an uninterrupted, secure, or error-free basis",
                "The results obtained from the Service will be accurate, reliable, complete, or suitable for any particular purpose",
                "Any errors in the Service will be corrected",
                "AI-generated code or content will be free from defects, security vulnerabilities, or legal issues",
                "The Service will be compatible with your systems, software, or devices",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Some jurisdictions do not allow the exclusion of implied warranties, so the above
              exclusions may not apply to you to the extent prohibited by law.
            </p>

            {/* 13. Liability */}
            <SectionAnchor id="liability" />
            <SectionTitle>13. Limitation of Liability</SectionTitle>
            <p>
              To the fullest extent permitted by applicable law, Lotus.build, its directors,
              employees, agents, affiliates, licensors, and service providers shall not be liable
              for any:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Indirect, incidental, special, consequential, or punitive damages",
                "Loss of profits, revenue, data, business, or goodwill",
                "Loss or corruption of data, including content you generate or store through the Service",
                "Cost of procurement of substitute services",
                "Damages arising from reliance on AI-generated output, including faulty code deployed to production",
                "Damages arising from unauthorised access to your account or data",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              In any case, our aggregate liability to you for all claims arising out of or relating
              to the Service shall not exceed the greater of (a) the total amount paid by you to
              Lotus.build during the 12 months preceding the claim, or (b) Â£100 (one hundred pounds
              sterling).
            </p>
            <p className="mt-4">
              These limitations apply regardless of the legal theory on which the claim is based
              (contract, tort, negligence, strict liability, or otherwise), even if Lotus.build has
              been advised of the possibility of such damages.
            </p>
            <p className="mt-4">
              Some jurisdictions do not allow the exclusion or limitation of certain damages, so the
              above limitations may not apply to you to the extent prohibited by applicable law. In
              particular, nothing in these Terms limits or excludes our liability for death or
              personal injury caused by our negligence, fraud or fraudulent misrepresentation, or
              any other liability that cannot be excluded by law.
            </p>

            {/* 14. Indemnification */}
            <SectionAnchor id="indemnification" />
            <SectionTitle>14. Indemnification</SectionTitle>
            <p>
              You agree to defend, indemnify, and hold harmless Lotus.build and its officers,
              directors, employees, and agents from and against any claims, liabilities, damages,
              losses, costs, and expenses (including reasonable legal fees) arising out of or
              related to:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Your use of the Service in violation of these Terms",
                "Your User Content or the use of your Generated Output",
                "Your violation of any applicable law or third-party right",
                "Your deployment of AI-generated code to production systems without adequate review",
                "Any actual or alleged infringement of any intellectual property or other right of any person or entity",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* 15. Termination */}
            <SectionAnchor id="termination" />
            <SectionTitle>15. Termination</SectionTitle>
            <p className="font-medium text-zinc-800">By You</p>
            <p className="mt-2">
              You may stop using the Service at any time and may delete your account through your
              account settings. Upon deletion, we will process your data deletion request in
              accordance with our Privacy Policy.
            </p>
            <p className="mt-4 font-medium text-zinc-800">By Us</p>
            <p className="mt-2">
              We may suspend or terminate your account and access to the Service immediately, with
              or without notice, if we reasonably believe you have materially breached these Terms,
              engaged in fraudulent activity, violated applicable law, or for any other reason at
              our sole discretion. We will generally attempt to provide advance notice where
              practicable, except where we determine that immediate action is necessary.
            </p>
            <p className="mt-4 font-medium text-zinc-800">Effect of Termination</p>
            <p className="mt-2">
              Upon termination: (a) your licence to use the Service ceases immediately; (b) any
              outstanding fees become immediately payable; (c) we may delete your account data in
              accordance with our Privacy Policy. Sections of these Terms that by their nature
              should survive termination shall survive, including sections on intellectual property,
              disclaimers, limitations of liability, indemnification, and governing law.
            </p>

            {/* 16. Governing Law */}
            <SectionAnchor id="governing-law" />
            <SectionTitle>16. Governing Law &amp; Dispute Resolution</SectionTitle>
            <p>
              These Terms and any dispute arising out of or in connection with them, including any
              question regarding their existence, validity, or termination, shall be governed by
              and construed in accordance with the laws of England and Wales, without regard to
              conflict of law principles.
            </p>
            <p className="mt-4">
              Subject to the paragraph below regarding EU/UK consumers, any dispute shall be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
            <p className="mt-4 font-medium text-zinc-800">EU/UK Consumer Rights</p>
            <p className="mt-2">
              If you are a consumer resident in the European Union or United Kingdom, nothing in
              these Terms affects your statutory rights under applicable consumer protection law,
              including any right to bring proceedings in the courts of your country of residence.
              EU consumers may also use the European Commission&rsquo;s Online Dispute Resolution
              platform at{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">
                ec.europa.eu/consumers/odr
              </a>
              .
            </p>

            {/* 17. Changes */}
            <SectionAnchor id="changes" />
            <SectionTitle>17. Changes to Terms</SectionTitle>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of
              material changes by posting the updated Terms on this page with a new &ldquo;Last
              Updated&rdquo; date, and where required by law, by sending you an email or in-app
              notification at least 30 days before the changes take effect.
            </p>
            <p className="mt-4">
              Your continued use of the Service after the effective date of any changes constitutes
              your acceptance of the revised Terms. If you do not agree to the revised Terms, you
              must stop using the Service before the changes take effect.
            </p>

            {/* 18. Contact */}
            <SectionAnchor id="contact" />
            <SectionTitle>18. Contact Us</SectionTitle>
            <p>
              If you have any questions about these Terms or the Service, please contact us:
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
              <p><span className="font-medium text-zinc-700">Help centre:</span>{" "}
                <Link href="/help" className="text-foreground underline-offset-2 hover:underline">
                  https://lotus-build.vercel.app/help
                </Link>
              </p>
            </div>

            {/* Divider */}
            <div className="mt-14 border-t border-zinc-200 pt-6 text-xs text-zinc-400 space-y-1">
              <p>These Terms of Service were last updated on {LAST_UPDATED}.</p>
              <p>
                See also:{" "}
                <Link href="/privacy" className="underline-offset-2 hover:underline hover:text-zinc-600">
                  Privacy Policy
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

