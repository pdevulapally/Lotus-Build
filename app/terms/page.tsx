"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Callout, LegalDocument, SectionTitle } from "@/components/content/legal-document"

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

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description={<>Please read these terms carefully before using Lotus.build. By accessing or using our
            service you agree to be bound by these terms.</>}
      effectiveDate={EFFECTIVE_DATE}
      lastUpdated={LAST_UPDATED}
      related={{ href: "/privacy", label: "Privacy Policy" }}
      sections={TOC}
      contact={{ title: "Questions?", description: "Our team is happy to help." }}
    >
            {/* 1. Acceptance */}
            <SectionTitle id="acceptance">1. Acceptance of Terms</SectionTitle>
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
            <SectionTitle id="services">2. Description of Services</SectionTitle>
            <p>
              LotusBuild is an AI software workspace for planning projects, implementing changes,
              and reviewing saved work using natural language prompts. The Service includes:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "AI-assisted software planning and implementation",
                "Project conversations and session activity",
                "Source-file review and saved-version comparisons",
                "Saved project downloads",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
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
            <SectionTitle id="eligibility">3. Eligibility</SectionTitle>
            <p>To use the Service, you must:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Be at least 18 years of age, or the age of legal majority in your jurisdiction if higher",
                "Have the legal capacity to enter into a binding contract",
                "Not be prohibited from using the Service under applicable law, including applicable export control or sanctions laws",
                "Not be located in a country subject to a United Kingdom, European Union, or United States government embargo",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              The Service is not directed to individuals under the age of 18. If we become aware
              that a user is under 18, we will terminate that account immediately.
            </p>

            {/* 4. Accounts */}
            <SectionTitle id="accounts">4. User Accounts</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
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
            <SectionTitle id="billing">5. Billing &amp; Subscriptions</SectionTitle>
            <p>
              Certain features of the Service require a paid subscription or the purchase of usage
              credits (&ldquo;Tokens&rdquo;). All billing is processed through Stripe, Inc., our
              third-party payment processor. By providing payment information, you authorise us to
              charge you for the applicable fees.
            </p>
            <p className="mt-4 font-medium text-foreground">Pricing</p>
            <p className="mt-2">
              Current pricing is available at{" "}
              <Link href="/pricing" className="font-medium text-foreground underline-offset-2 hover:underline">
                https://lotus-build.vercel.app/pricing
              </Link>
              . All prices are displayed exclusive of applicable taxes unless stated otherwise.
              You are responsible for any value-added tax (VAT), goods and services tax (GST), or
              other applicable taxes in your jurisdiction.
            </p>
            <p className="mt-4 font-medium text-foreground">Subscriptions</p>
            <p className="mt-2">
              Subscriptions are billed on a recurring basis (monthly or annually) as selected at
              the time of purchase. Your subscription will automatically renew at the end of each
              billing period unless you cancel it before the renewal date. You can cancel your
              subscription at any time through your account settings.
            </p>
            <p className="mt-4 font-medium text-foreground">Refunds</p>
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
            <p className="mt-4 font-medium text-foreground">Price Changes</p>
            <p className="mt-2">
              We reserve the right to change our pricing at any time. For existing subscribers, we
              will provide at least 30 days&rsquo; notice before any price change takes effect. Your
              continued use of the Service after the effective date constitutes acceptance of the
              new pricing.
            </p>

            {/* 6. AI-Generated Content */}
            <SectionTitle id="ai-content">6. AI-Generated Content</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
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
            <SectionTitle id="ip">7. Intellectual Property</SectionTitle>
            <p className="font-medium text-foreground">Our Intellectual Property</p>
            <p className="mt-2">
              The Service and its original content (excluding user-provided content and AI-generated
              output), features, functionality, branding, trademarks, logos, and software are and
              will remain the exclusive property of Lotus.build and its licensors. You may not copy,
              modify, distribute, sell, or lease any part of the Service or its underlying
              technology without our express written permission.
            </p>
            <p className="mt-4 font-medium text-foreground">User Content</p>
            <p className="mt-2">
              You retain all rights to the content, data, and materials you upload or input into
              the Service (&ldquo;User Content&rdquo;). By submitting User Content, you grant
              Lotus.build a non-exclusive, worldwide, royalty-free licence to use, process, store,
              and transmit your User Content solely to the extent necessary to provide the Service
              to you.
            </p>
            <p className="mt-4 font-medium text-foreground">AI-Generated Output</p>
            <p className="mt-2">
              Subject to these Terms and applicable law, you own the code, designs, and other
              content generated by the Service in response to your prompts (&ldquo;Generated
              Output&rdquo;). However, because AI output is derived from models trained on broad
              datasets, we cannot guarantee that Generated Output is free from third-party
              intellectual property claims. You accept sole responsibility for any IP issues
              arising from your use of Generated Output.
            </p>
            <p className="mt-4 font-medium text-foreground">Feedback</p>
            <p className="mt-2">
              If you provide us with feedback, suggestions, or ideas about the Service
              (&ldquo;Feedback&rdquo;), you grant us an irrevocable, perpetual, worldwide,
              royalty-free right to use that Feedback for any purpose without compensation to you.
            </p>

            {/* 8. Acceptable Use */}
            <SectionTitle id="acceptable-use">8. Acceptable Use Policy</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
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
            <SectionTitle id="third-party">9. Third-Party Services &amp; Integrations</SectionTitle>
            <p>
              The Service integrates with and relies upon various third-party platforms and services,
              including:
            </p>
            <div className="mt-6 divide-y divide-border">
              {[
                { name: "OpenAI & Anthropic", desc: "AI model providers powering code generation and agent features" },
                { name: "Firebase / Google Cloud", desc: "Authentication, database, and infrastructure" },
                { name: "Stripe", desc: "Payment processing and subscription management" },
                { name: "GitHub", desc: "Version control and code repository integration" },
                { name: "Supabase", desc: "Database provisioning and backend integration" },
                { name: "Vercel & Netlify", desc: "Application deployment and hosting" },
                { name: "E2B", desc: "Sandboxed code execution environments" },
              ].map(({ name, desc }) => (
                <div key={name} className="py-5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{desc}</p>
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
            <SectionTitle id="data">10. Data &amp; Privacy</SectionTitle>
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
            <SectionTitle id="security">11. Security</SectionTitle>
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
            <SectionTitle id="disclaimers">12. Disclaimers of Warranties</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Some jurisdictions do not allow the exclusion of implied warranties, so the above
              exclusions may not apply to you to the extent prohibited by law.
            </p>

            {/* 13. Liability */}
            <SectionTitle id="liability">13. Limitation of Liability</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
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
            <SectionTitle id="indemnification">14. Indemnification</SectionTitle>
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* 15. Termination */}
            <SectionTitle id="termination">15. Termination</SectionTitle>
            <p className="font-medium text-foreground">By You</p>
            <p className="mt-2">
              You may stop using the Service at any time and may delete your account through your
              account settings. Upon deletion, we will process your data deletion request in
              accordance with our Privacy Policy.
            </p>
            <p className="mt-4 font-medium text-foreground">By Us</p>
            <p className="mt-2">
              We may suspend or terminate your account and access to the Service immediately, with
              or without notice, if we reasonably believe you have materially breached these Terms,
              engaged in fraudulent activity, violated applicable law, or for any other reason at
              our sole discretion. We will generally attempt to provide advance notice where
              practicable, except where we determine that immediate action is necessary.
            </p>
            <p className="mt-4 font-medium text-foreground">Effect of Termination</p>
            <p className="mt-2">
              Upon termination: (a) your licence to use the Service ceases immediately; (b) any
              outstanding fees become immediately payable; (c) we may delete your account data in
              accordance with our Privacy Policy. Sections of these Terms that by their nature
              should survive termination shall survive, including sections on intellectual property,
              disclaimers, limitations of liability, indemnification, and governing law.
            </p>

            {/* 16. Governing Law */}
            <SectionTitle id="governing-law">16. Governing Law &amp; Dispute Resolution</SectionTitle>
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
            <p className="mt-4 font-medium text-foreground">EU/UK Consumer Rights</p>
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
            <SectionTitle id="changes">17. Changes to Terms</SectionTitle>
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
            <SectionTitle id="contact">18. Contact Us</SectionTitle>
            <p>
              If you have any questions about these Terms or the Service, please contact us:
            </p>
            <div className="my-6 border-l border-border pl-5 space-y-2 text-sm">
              <p><span className="font-medium text-foreground">Email:</span>{" "}
                <a href="mailto:arpkwebsitedevelopment@gmail.com" className="text-foreground underline-offset-2 hover:underline">
                  arpkwebsitedevelopment@gmail.com
                </a>
              </p>
              <p><span className="font-medium text-foreground">Website:</span>{" "}
                <a href="https://lotus-build.vercel.app" target="_blank" rel="noopener noreferrer" className="text-foreground underline-offset-2 hover:underline">
                  https://lotus-build.vercel.app
                </a>
              </p>
              <p><span className="font-medium text-foreground">Help centre:</span>{" "}
                <Link href="/help" className="text-foreground underline-offset-2 hover:underline">
                  https://lotus-build.vercel.app/help
                </Link>
              </p>
            </div>

            {/* Divider */}
            <div className="mt-14 border-t border-border pt-6 text-xs text-muted-foreground space-y-1">
              <p>These Terms of Service were last updated on {LAST_UPDATED}.</p>
              <p>
                See also:{" "}
                <Link href="/privacy" className="underline-offset-2 hover:underline hover:text-foreground">
                  Privacy Policy
                </Link>
              </p>
            </div>
    </LegalDocument>
  )
}
