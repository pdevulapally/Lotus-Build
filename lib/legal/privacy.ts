import { email, legalIdentity as id, legalDocumentVersion, link, type LegalDocumentContent } from './model'

export const privacyPolicy: LegalDocumentContent = {
  title: 'Privacy Policy',
  description: `How personal data is handled when you use ${id.tradingName} to develop software, run agents and connect your tools.`,
  effectiveDate: '18 October 2026',
  lastUpdated: '1 November 2026',
  version: legalDocumentVersion,
  related: { href: '/terms', label: 'Terms of Service' },
  contact: { title: 'Privacy enquiries', description: 'Ask about your information or exercise your privacy rights.' },
  sections: [
    { id: 'who-we-are', label: 'Identity and roles', title: 'Identity, contact and processing roles', blocks: [
      { kind: 'p', text: `This policy covers personal data handled in connection with ${id.tradingName}, the software development platform at ${id.siteUrl}. Our company details are ${id.legalName}, registered in ${id.registrationJurisdiction}, company number ${id.companyNumber}.` },
      { kind: 'p', text: ['You can contact us at ', email(), '. Our company record is available at ', link('Companies House', id.companiesHouseUrl), '.'] },
      { kind: 'p', text: 'We act as controller when we determine how personal data is used to administer accounts, payments, security and support. For personal data a business customer submits for processing on its instructions, that customer may be the controller and we may be its processor. The role depends on the activity. A separate data processing agreement is needed where required; this policy does not replace one. Contact us before submitting information that requires specific processing terms.' },
    ] },
    { id: 'what-we-collect', label: 'Data we handle', title: 'Data categories and sources', blocks: [
      { kind: 'table', label: 'Data categories and sources', columns: ['Category', 'Examples and source'], rows: [
        ['Account and identity', 'Email, identifier, display name, verification state and profile image from you and a sign-in provider. Firebase handles email/password or supported federated sign-in. GitHub sign-in and a GitHub repository installation are different permissions.'],
        ['Development content', 'Prompts, answers, chat history, plans, uploads, repository files and metadata, generated code, file changes, saved versions and downloads, supplied by you, a connected service or the agent. Files may contain personal data about other people.'],
        ['Execution and activity', 'Commands, terminal output, tool results, session and task status, browser/computer screenshots or page content when those tools run, preview addresses, usage records, errors and approval records.'],
        ['Connections', 'External account and installation identifiers, selected repositories and branches, granted permissions, project access grants and connection credentials handled by the backend.'],
        ['Voice, when available and started', 'Microphone audio, generated speech, recent project context and final voice dialogue. Final dialogue is saved as project chat context. Voice availability is determined by the server.'],
        ['Billing and support', 'Stripe customer/subscription references, plan and usage records, checkout information, correspondence and privacy-request references. Card entry is directed to Stripe-hosted checkout.'],
        ['Technical information and preferences', 'Network/request metadata and security logs; browser sign-in storage; pending mutation and checkout identifiers; drafts, theme choices and cookie choices. Optional public-page analytics is controlled separately.'],
      ] },
      { kind: 'p', text: 'Use only the information needed for your task. Remove unnecessary personal data, production secrets and confidential material before uploading or granting access. You must have authority and an appropriate legal basis to provide other people’s information. This does not remove our own legal responsibilities. Contact us before submitting special-category information, criminal-offence data or regulated workloads that require specific safeguards or processing terms.' },
    ] },
    { id: 'how-we-use', label: 'Purposes and legal bases', title: 'Purposes and lawful bases', blocks: [
      { kind: 'p', text: 'For activities subject to UK or EEA data-protection law, the applicable lawful basis depends on the purpose and our role. Contract necessity applies only where processing is needed for the individual’s contract; it is not a blanket basis for all data in customer repositories.' },
      { kind: 'table', label: 'Purposes and legal bases', columns: ['Purpose', 'Basis and boundary'], rows: [
        ['Provide accounts, requested projects, sessions and billing', 'Contract where needed to supply the individual’s requested service. For organisation contacts, legitimate interests in administering the business relationship may apply. Customer-controlled project data requires separate processor instructions or another documented basis.'],
        ['Prevent abuse, investigate errors and protect accounts', 'Legitimate interests in security, fraud prevention and reliable operation, balanced against individuals’ rights; legal obligation where a specific duty applies.'],
        ['Tax, accounting, rights requests and regulatory duties', 'Applicable legal obligations. Specific record categories and retention requirements must be established.'],
        ['Support, complaints and legal claims', 'Contract, legal obligation or legitimate interests in handling enquiries and defending claims, depending on the matter.'],
        ['Optional public-page analytics', 'Consent under the implemented choice-based approach. Rejecting or withdrawing does not prevent use of the service. No analytics exception is assumed.'],
      ] },
      { kind: 'p', text: 'Where consent is relied on, you can withdraw it for future processing. Where legitimate interests are relied on, you may object. Different legal grounds or additional protections may apply under the law of your country.' },
    ] },
    { id: 'ai-processing', label: 'AI, agents and voice', title: 'AI requests, execution and voice', blocks: [
      { kind: 'list', items: [
        'A model request can include your prompt, earlier messages, relevant source files, attachments and tool results. The service supports Anthropic and an optional NVIDIA API Catalog fallback; a fallback route can involve a downstream model provider. The model catalog and server configuration determine availability. Provider terms and account settings affect retention, processing location and use of data. Contact us about those arrangements before submitting information with specific confidentiality, training or residency restrictions.',
        'Agents can read and change project files, execute commands, access network services and use browser or computer tools when available. Screenshots, web content, terminal results and repository material can become model context. Instructions embedded in third-party material may be malicious; use least-privilege access and review external actions.',
        'The service uses E2B sandboxes and separately saved project content. A sandbox is a running environment, not your sole saved copy. Stopping audio, stopping a task, ending a sandbox, saving files and deleting a project are different operations. Temporary environments and provider copies can have different deletion processes from saved project files.',
        'When you start available voice functionality, audio and recent project context are relayed to the configured ElevenLabs agent. Final dialogue is saved in chat. Consult the voice information presented by the service before starting a call. Ending the call stops that call’s audio sharing; accepted development work may continue. Use the task controls to cancel work.',
      ] },
      { kind: 'p', text: 'The AI features generate software and assist with tasks. Do not deploy generated systems to make decisions about individuals with legal or similarly significant effects without a separate assessment of their lawfulness, oversight and safeguards.' },
    ] },
    { id: 'connections', label: 'Connected accounts', title: 'GitHub and other connected services', blocks: [
      { kind: 'p', text: 'Connecting an account authorises access within the permissions you grant. GitHub repository access uses an App installation and project grants; it can expose repository names, source, history, author information and branch or pull-request details. Cloning and local commits differ from a remote push or pull request. The GitHub connector has action-specific approvals for external writes; ordinary shell or browser operations must not be assumed to have the same gate.' },
      { kind: 'p', text: 'Other catalog entries include Netlify, Vercel, Slack, AWS and custom MCP servers. Listing a connector does not mean it is configured, enabled or implemented end to end. Where a service is available, its account permissions, selected resources and actions determine the data exchanged. Only grant resources needed for the project. An agent may disclose content through an authorised API call, message, deployment or network request.' },
      { kind: 'p', text: 'Disconnecting LotusBuild does not necessarily uninstall an app or revoke every permission held by the external service. Review the confirmation and revoke access in that service’s own settings where needed. Copies already pushed, published or sent may remain outside LotusBuild’s control.' },
    ] },
    { id: 'sharing', label: 'Recipients', title: 'Recipients and disclosure', blocks: [
      { kind: 'table', label: 'Services and data recipients', columns: ['Service', 'Purpose and data'], rows: [
        ['Google/Firebase', 'Authentication, backend account/project records and saved project objects; sign-in and development data.'],
        ['Anthropic; NVIDIA and selected downstream providers when configured', 'Model inference using task context and tool results. The selected model and configured route determine the recipients.'],
        ['E2B', 'Execution environments, source files, commands and running previews.'],
        ['ElevenLabs, when voice is available and used', 'Live audio, conversation context and generated voice responses.'],
        ['Stripe', 'Hosted checkout, subscription management and payment-related account information. Stripe may also determine purposes for its own regulatory and fraud functions.'],
        ['Brevo', 'Transactional email such as verification messages.'],
        ['Vercel and API infrastructure operators', 'Website/API delivery, operational metadata and, after consent, public-page analytics.'],
        ['GitHub and other user-connected services', 'Resource permissions and task content needed for the particular connection or action. They may act under their own terms for their own purposes.'],
      ] },
      { kind: 'p', text: 'Legal process, security investigations, professional advice or a business transfer may require disclosure where lawful and necessary. Service providers and connected accounts can have different responsibilities for processing. Sharing information to perform a requested task is distinct from making your project publicly available. Contact us for information about the recipients relevant to your use.' },
    ] },
    { id: 'international', label: 'International processing', title: 'International processing and safeguards', blocks: [
      { kind: 'p', text: 'LotusBuild is based in the United Kingdom. Providers, connected services and their support teams may process personal data in other countries. The location can depend on the model, account settings and service you connect. Laws in those countries may differ from those where you live.' },
      { kind: 'p', text: ['Restricted transfers are subject to applicable legal requirements, including an appropriate transfer mechanism and assessment where required. Contact ', email(), ' for information about the processing locations and safeguards relevant to your account before submitting data with residency restrictions. This policy does not itself create a transfer agreement or certify a provider’s status.'] },
    ] },
    { id: 'retention', label: 'Retention and deletion', title: 'Retention, deletion and backups', blocks: [
      { kind: 'p', text: 'Retention depends on the type of data, the requested service, security and recovery needs, applicable recordkeeping duties and the period reasonably needed to resolve disputes or claims. These criteria do not authorise keeping all information indefinitely.' },
      { kind: 'list', items: [
        'Projects, conversations, snapshots, attachments and activity records have different storage paths. Deleting a project initiates backend cleanup; it is not proof of completed deletion across provider systems or backups.',
        'Reconnect events use a rolling retention setting and event limits. Session history, logs and saved source have separate purposes and retention processes.',
        'Account erasure is a reviewed request. The operator workflow disables access, handles active work and usage, removes live content and identity, and distinguishes retained financial/request records from provider copies awaiting confirmation. Submitting a request is not immediate deletion or cancellation of a subscription.',
        'Financial records, fraud evidence and rights-request records may need limited retention for applicable obligations or claims after an account closes.',
        'Backups, provider copies, GitHub commits and content you have published can remain after live deletion and follow separate deletion or expiry processes. Deleting information in LotusBuild does not automatically erase copies you have sent elsewhere.',
      ] },
    ] },
    { id: 'your-rights', label: 'Your rights', title: 'Rights, requests and account closure', blocks: [
      { kind: 'p', text: 'Depending on applicable law, you may request access, correction, deletion, restriction, portability, or object to particular processing; you may withdraw consent. Some laws provide additional information, appeal or opt-out rights. Rights have legal conditions and exceptions; a UK choice-of-law clause does not remove local rights.' },
      { kind: 'p', text: ['Use Settings to request account erasure or email ', email(), ' for other requests, closure questions and complaints. We may need proportionate identity or authority verification. Under UK/EEA law requests are normally due within one month, with extensions or other adjustments only where legally allowed and explained. Other countries have different deadlines. A project ZIP contains project files, not necessarily every item of personal data held about you.'] },
      { kind: 'p', text: 'A business customer’s controller normally handles rights concerning data it supplied for its own purposes; contact it or ask us to help direct your request. Do not include unnecessary identity documents or passwords in an email.' },
    ] },
    { id: 'cookies', label: 'Cookies and storage', title: 'Cookies, browser storage and analytics', blocks: [
      { kind: 'table', label: 'Browser storage and choices', columns: ['Purpose', 'Behaviour and control'], rows: [
        ['Requested service and security', 'Firebase sign-in storage; pending request identities; session drafts and checkout recovery; remembered theme choices; the cookie-choice record. These support requested functions and are separate from optional analytics. Removing this storage can sign you out or prevent request recovery.'],
        ['Cookie choice', 'lotus-cookie-consent in localStorage records a version, analytics choice and decision time. Invalid or older-format choices do not authorise analytics. Browser data deletion removes the saved choice; a policy-version change can require a new choice.'],
        ['Optional Vercel Web Analytics', 'Loaded only after analytics is accepted. A check before events are sent applies your current choice and excludes workspace, sign-in and callback routes. Only selected public information pages are measured; event URL queries and fragments are removed.'],
      ] },
      { kind: 'p', text: 'Choose Reject optional, Accept analytics or Manage preferences in the banner. Reopen Cookie preferences in the footer or Settings to withdraw or change your choice. Blocking storage may prevent persistence; an error is shown and optional analytics is disabled in that tab. Changing analytics does not sign you out or alter a requested theme. Previously sent events cannot be recalled by withdrawing consent.' },
      { kind: 'p', text: 'We ask for consent for optional analytics. Connected services and generated previews may use their own storage under their own notices. Cookie preferences are separate from your agreement to the Terms and from authorising an agent action.' },
    ] },
    { id: 'security', label: 'Security and exposure', title: 'Security, previews and incidents', blocks: [
      { kind: 'p', text: 'The service uses token-based authentication and ownership checks for protected resources, server-side handling of connection credentials, and sandbox execution. Some resources are intentionally public, such as the plan catalog, callbacks and authorised shared resources. Security measures reduce risk but cannot eliminate every risk or guarantee that an incident will never occur.' },
      { kind: 'p', text: 'Treat preview addresses, shared links, deployments and repository publication as possible disclosures to others. Check the applicable sharing and access settings. Do not put secrets or personal data in a preview on the assumption that possession of its URL cannot grant access.' },
      { kind: 'p', text: 'Incident handling must include containment, investigation and legally required reporting. UK/EEA rules can require authority notification within 72 hours of awareness unless the legal risk exception applies, and notification to affected people without undue delay for high risk. Other regimes have different tests and deadlines. No certification, absolute isolation or zero-risk promise is made.' },
    ] },
    { id: 'children', label: 'Age limits', title: 'Age limits', blocks: [
      { kind: 'p', text: `The service is intended for users aged ${id.minimumAge} or over. If you believe a child’s information has been provided to LotusBuild, contact us so that it can be investigated and appropriate action taken. Do not use another person’s account to bypass age restrictions.` },
    ] },
    { id: 'changes', label: 'Updates', title: 'Changes and country-specific notices', blocks: [
      { kind: 'p', text: 'Updates to this policy will identify their effective date and explain material changes where required. A policy update does not itself supply consent for a new purpose. Local privacy rights and mandatory protections continue to apply; contact us if you need information about a country-specific requirement.' },
    ] },
    { id: 'complaints', label: 'Complaints', title: 'Questions and complaints', blocks: [
      { kind: 'p', text: 'For a data-protection complaint subject to UK law, we must acknowledge receipt within 30 days, investigate appropriately and communicate the outcome without undue delay. A complaint and a request to exercise a privacy right have different legal response requirements.' },
      { kind: 'p', text: ['Contact ', email(), ' with privacy concerns. You may also complain to the ', link(id.supervisoryAuthority.name, id.supervisoryAuthority.url), ', or the competent authority where applicable law gives you that right. You do not have to give up a regulator complaint or legal remedy to use the support process.'] },
    ] },
  ],
}
