export const lotusBuildSupportEmail = 'lotusbuild.support@gmail.com'
export const lotusBuildSupportAreas = [
  { title: 'Projects and sessions', description: 'Opening projects, messages, session errors and saved changes.' },
  { title: 'Account and billing', description: 'Sign-in, email verification, current plans and account usage.' },
  { title: 'Files and versions', description: 'Reading source files in the Files tab and comparing saved versions.' },
] as const

export type HelpTopic = 'getting-started' | 'saved-work' | 'billing'
export const lotusBuildHelpTopics = [
  { key: 'getting-started', label: 'Getting started' },
  { key: 'saved-work', label: 'Files and versions' },
  { key: 'billing', label: 'Usage and billing' },
] as const satisfies ReadonlyArray<{ key: HelpTopic; label: string }>

export const lotusBuildFaqs = [
  { topic: 'getting-started', q: 'How do I start a project?', a: 'Describe what you want to build on the home page and sign in. Choose Plan to talk it through first or Build to go straight to a first version, then send the request.' },
  { topic: 'getting-started', q: 'What does Plan mode do?', a: 'Plan works through the approach before anything is built. LotusBuild asks a few questions, proposes a plan you can change, and you choose Build this plan when you are ready.' },
  { topic: 'getting-started', q: 'Where can I see what the agent is doing?', a: 'The side panel opens during a run. Terminal shows each command and its output, Preview opens as soon as your build is ready to try, and Files shows the source.' },
  { topic: 'saved-work', q: 'Where do I find my files and versions?', a: 'Open the Files tab in your project to read the saved source. Version history lists each saved change so you can compare what changed between versions.' },
  { topic: 'billing', q: 'How do I check usage?', a: 'Open Settings and choose Usage for your account meters. Session usage below the conversation shows what that session has used.' },
  { topic: 'billing', q: 'Which models and plans are available?', a: 'The model menu shows the catalogue available to your signed-in account. Pricing shows the current plans, prices and included usage.' },
] as const satisfies ReadonlyArray<{ topic: HelpTopic; q: string; a: string }>
