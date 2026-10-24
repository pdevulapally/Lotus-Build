export const lotusBuildSupportEmail = 'lotusbuild.support@gmail.com'
export const lotusBuildSupportAreas = [
  { title: 'Tasks and recovery', description: 'Opening tasks, messages, approval requests and interrupted work.' },
  { title: 'Account and billing', description: 'Sign-in, verification and help with existing subscriptions.' },
  { title: 'Previous workspace', description: 'Questions about old project links and future data migration.' },
] as const
export type HelpTopic = 'getting-started' | 'saved-work' | 'billing'
export const lotusBuildHelpTopics = [
  { key: 'getting-started', label: 'Getting started' },
  { key: 'saved-work', label: 'Saved work' },
  { key: 'billing', label: 'Account and billing' },
] as const satisfies ReadonlyArray<{ key: HelpTopic; label: string }>
export const lotusBuildFaqs = [
  { topic: 'getting-started', q: 'How do I start a task?', a: 'Open the new workspace, sign in and verify your email. Describe your goal and choose Code or Desktop. An operator must configure the replacement API before tasks can run.' },
  { topic: 'getting-started', q: 'When do I need to approve an action?', a: 'The server identifies actions that need permission. Review the exact action details before choosing approve or deny. A decision applies only to that request; stopping a task is a separate action.' },
  { topic: 'getting-started', q: 'Where can I see progress?', a: 'The workspace displays the saved conversation and current task state. It checks for updates while work is active. File browsing, live previews and terminal streaming are not connected in this version.' },
  { topic: 'saved-work', q: 'How do I return to a task?', a: 'Keep its workspace URL or task ID. Open that URL or paste the ID into the new workspace. A browsable task history is not available yet.' },
  { topic: 'saved-work', q: 'What happened to my old project links?', a: 'Old project and computer links show a transition notice. Their data has not been copied into the new task API, and this frontend change does not delete it. Contact support about migration before retiring the old service.' },
  { topic: 'billing', q: 'How do I check usage or manage billing?', a: 'Usage meters, checkout and the billing portal are not connected to the new workspace. Existing subscriptions are not cancelled by this change. Contact support for help with them.' },
  { topic: 'billing', q: 'How do I verify my account?', a: 'Use Send verification link on the verification page, open the Firebase email link, then return and select I’ve verified my email. No six-digit code from the old service is needed.' },
] as const satisfies ReadonlyArray<{ topic: HelpTopic; q: string; a: string }>
