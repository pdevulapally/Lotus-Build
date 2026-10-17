export const lotusBuildSupportEmail = 'lotusbuild.support@gmail.com'
export const lotusBuildSupportAreas = [
  { title: 'Projects and sessions', description: 'Opening projects, messages, session errors and saved changes.' },
  { title: 'Account and billing', description: 'Sign-in, email verification, current plans and account usage.' },
  { title: 'Saved files', description: 'Reading source files, reviewing diffs and downloading a project ZIP.' },
] as const
export const lotusBuildFaqs = [
  { q: 'How do I start a project?', a: 'Write a brief and sign in. Choose a model available on your account, select Plan or Build, then send the request.' },
  { q: 'What does Plan mode do?', a: 'Use Plan to work through the approach before building. Once an idle plan is ready, choose Build this plan to start a build turn.' },
  { q: 'Where do I find saved files?', a: 'Open the Code tab in your project session to inspect saved source files or download a ZIP. Version history shows saved changes and diffs.' },
  { q: 'How do I check usage?', a: 'Open Settings and choose Usage for account meters. Session usage below the conversation shows usage recorded against that session.' },
  { q: 'Which models and plans are available?', a: 'The model menu shows the catalog available to your signed-in account. Pricing shows the current plans returned by the server.' },
] as const
