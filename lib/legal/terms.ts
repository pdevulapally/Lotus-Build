import { email, legalIdentity as id, link, strong, type LegalDocumentContent } from './model'

export const termsOfService: LegalDocumentContent = {
  title: 'Terms of Service',
  description: `The agreement between you and ${id.tradingName} for using the LotusBuild workspace to plan, build and preview software.`,
  effectiveDate: '18 October 2026',
  lastUpdated: '1 November 2026',
  notice: 'If you are a consumer in the UK, nothing in these terms affects your statutory rights under the Consumer Rights Act 2015 or the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.',
  related: { href: '/privacy', label: 'Privacy Policy' },
  contact: { title: 'Questions?', description: 'We are happy to explain anything in these terms.' },
  sections: [
    { id: 'about', label: 'About these terms', title: 'About these terms', blocks: [
      { kind: 'p', text: [`These terms apply when you use ${id.siteUrl}, the LotusBuild workspace and our API (the “Service”), provided by ${id.tradingName} (“we”, “us”). Our `, link('Privacy Policy', '/privacy'), ' explains how we use personal data.'] },
      { kind: 'p', text: 'By creating an account or using the Service you accept these terms. If you use the Service for a business, you confirm you can accept them for that business, and the business-user sections below apply.' },
      { kind: 'p', text: ['Contact us at ', email(), '.'] },
    ] },
    { id: 'service', label: 'The Service', title: 'What the Service does', blocks: [
      { kind: 'list', items: [
        'Plan mode: work through what to build with an AI agent before anything is built.',
        'Build mode: the agent writes and changes code in your project and runs it in an isolated sandbox.',
        'Previews of your running project, which are private unless you turn on public preview.',
        'Saved source files, version history and project downloads as a ZIP.',
        'Voice conversations started with the waveform button. Live audio and recent project conversation are sent to ElevenLabs; final dialogue is saved in your project chat. Ending voice stops audio sharing and does not cancel accepted project work.',
      ] },
      { kind: 'p', text: 'The models, features and allowances available to you depend on your plan and are shown in the Service and on the Pricing page. We may improve or change features; if a change materially reduces what you have paid for, we will tell you in advance and you may cancel.' },
    ] },
    { id: 'accounts', label: 'Your account', title: 'Your account', blocks: [
      { kind: 'list', items: [
        `You must be at least ${id.minimumAge} and able to enter into a binding contract.`,
        'Give accurate details and verify your email address before using paid or build features.',
        'Keep your sign-in secure and tell us promptly if you think someone else has accessed your account.',
        'You are responsible for activity under your account unless it results from our failure to keep the Service secure.',
      ] },
    ] },
    { id: 'billing', label: 'Plans and payment', title: 'Plans, payment and cancellation', blocks: [
      { kind: 'h3', text: 'Prices' },
      { kind: 'p', text: 'Plan prices, allowances and whether VAT is included are shown on the Pricing page and again at Stripe checkout before you pay. Payments are processed by Stripe; we never see your full card details.' },
      { kind: 'h3', text: 'Subscriptions' },
      { kind: 'p', text: 'Paid plans are subscriptions that renew automatically at the end of each billing period until you cancel. You can cancel at any time in the billing portal from Settings; cancellation stops the next renewal and you keep access until the end of the period you have paid for.' },
      { kind: 'h3', text: 'Your 14-day right to cancel (UK consumers)' },
      { kind: 'p', text: 'If you are a consumer, you can cancel a new subscription within 14 days of buying it without giving a reason. Because the Service starts as soon as you subscribe, at your request, you will receive a refund minus a proportionate amount for the service provided up to the time you tell us you are cancelling. To cancel, email us or use the billing portal and contact us within the 14 days. We will refund you within 14 days of being told, using the original payment method.' },
      { kind: 'h3', text: 'Usage allowances' },
      { kind: 'p', text: 'Plans include usage allowances that are measured and shown in Settings. When an allowance is used up, work that needs more usage will not start until the allowance resets or you change plan. Unused allowance does not carry over unless your plan says it does.' },
      { kind: 'h3', text: 'Price changes' },
      { kind: 'p', text: 'We will give you at least 30 days’ notice of a price increase before it applies to your next renewal. If you do not want to continue, you can cancel before the new price applies.' },
      { kind: 'h3', text: 'Failed payments' },
      { kind: 'p', text: 'If a payment fails, Stripe may retry it. If payment is still not received, we may move your account to the free plan; your projects are not deleted because of a failed payment.' },
    ] },
    { id: 'your-content', label: 'Your content and output', title: 'Your content and generated output', blocks: [
      { kind: 'p', text: [strong('You own your prompts, uploads and projects, and the code and content the Service generates for you'), ', to the extent the law allows ownership of AI-generated material. We do not claim ownership of them.'] },
      { kind: 'p', text: 'You give us permission to store, copy, process and transmit your content only as needed to run the Service for you, including sending it to the providers listed in our Privacy Policy. We do not use your content to train AI models.' },
      { kind: 'p', text: 'You are responsible for having the rights to anything you put into the Service and for how you use the output, including checking that it does not infringe anyone else’s rights.' },
    ] },
    { id: 'ai-output', label: 'AI output', title: 'AI-generated output', blocks: [
      { kind: 'callout', variant: 'warn', text: 'AI output can contain mistakes, security weaknesses or code that does not work as expected. Review and test it before you rely on it or put it into production, and do not rely on it for legal, financial, medical or safety-critical decisions without professional advice.' },
      { kind: 'p', text: 'We provide the Service with reasonable care and skill. Because AI output depends on your instructions and is probabilistic, we cannot promise that any particular output will be correct, unique or suitable for a specific purpose.' },
    ] },
    { id: 'acceptable-use', label: 'Acceptable use', title: 'Acceptable use', blocks: [
      { kind: 'p', text: 'You must not use the Service to:' },
      { kind: 'list', items: [
        'break the law or help anyone else to, including fraud, harassment, or infringing intellectual property or privacy rights;',
        'build or run malware, phishing pages, credential theft, denial-of-service tools or unauthorised scanning of systems you do not own;',
        'create content that sexualises children, promotes terrorism or violence, or is otherwise unlawful;',
        'mine cryptocurrency, run unrelated workloads in sandboxes, or try to escape a sandbox;',
        'get around plan limits, rate limits, authentication or security controls, or access another user’s data;',
        'resell or provide the Service to others as your own without our written agreement.',
      ] },
      { kind: 'p', text: 'We may remove content or stop a session that breaks these rules and, where appropriate, report it to the authorities.' },
    ] },
    { id: 'our-ip', label: 'Our rights', title: 'Our intellectual property', blocks: [
      { kind: 'p', text: 'The Service, its software, design and the LotusBuild name and logo belong to us or our licensors. These terms give you a personal, non-transferable right to use the Service; they do not transfer any of our intellectual property to you. If you send us feedback, we may use it without obligation to you.' },
    ] },
    { id: 'third-parties', label: 'Third-party services', title: 'Third-party services', blocks: [
      { kind: 'p', text: 'The Service relies on providers such as Google, Anthropic, ElevenLabs, E2B, Stripe and Vercel. If you connect or deploy to another service, that service’s own terms apply to your use of it.' },
    ] },
    { id: 'suspension', label: 'Suspension and closure', title: 'Suspension and closing your account', blocks: [
      { kind: 'p', text: 'You can stop using the Service at any time and request account erasure from Settings. Cancel any subscription first so you are not charged again.' },
      { kind: 'p', text: 'We may suspend or close your account if you seriously or repeatedly break these terms, if we must do so by law, or to protect the Service or other users. Unless it would be unlawful or create a security risk, we will tell you why and give you a reasonable chance to download your projects. If we close a paid account without you being at fault, we will refund any prepaid amount for the period not provided.' },
    ] },
    { id: 'liability', label: 'Liability', title: 'Our responsibility to you', blocks: [
      { kind: 'h3', text: 'If you are a consumer' },
      { kind: 'p', text: 'We are responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill. We are not responsible for loss that was not foreseeable. We only provide the Service for domestic and private use; if you use it for a business, we are not liable to you as a consumer for loss of profit, business or business opportunity.' },
      { kind: 'p', text: 'If digital content we supply damages a device or other digital content of yours because we did not use reasonable care and skill, we will repair the damage or pay you compensation.' },
      { kind: 'h3', text: 'If you are a business user' },
      { kind: 'p', text: 'We are not liable for loss of profits, revenue, data, goodwill or any indirect or consequential loss. Our total liability under or in connection with these terms in any 12-month period is limited to the fees you paid us in that period. Statutory terms implied into these terms are excluded to the extent the law allows.' },
      { kind: 'h3', text: 'For everyone' },
      { kind: 'p', text: 'Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited or excluded by law.' },
    ] },
    { id: 'changes', label: 'Changes to these terms', title: 'Changes to these terms', blocks: [
      { kind: 'p', text: 'We may update these terms to reflect changes to the Service or the law. We will give you at least 30 days’ notice of changes that materially affect you. If you do not agree, you may cancel before they take effect; otherwise the updated terms apply from their effective date.' },
    ] },
    { id: 'law', label: 'Law and disputes', title: 'Governing law and disputes', blocks: [
      { kind: 'p', text: ['If you have a problem, please contact us first at ', email(), ' so we can try to resolve it.'] },
      { kind: 'p', text: `These terms are governed by ${id.governingLaw}, and the ${id.courts} have jurisdiction. If you are a consumer living in Scotland or Northern Ireland, you can also bring proceedings in your local courts, and the mandatory consumer law of your home country continues to protect you.` },
      { kind: 'p', text: 'If any part of these terms is found to be unenforceable, the rest remains in effect. These terms are between you and us; no one else has rights under them.' },
    ] },
  ],
}
