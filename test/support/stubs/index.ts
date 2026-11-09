/** Module specifiers the lifecycle tests replace, and the fake that stands in (relative to `test/support`). */
export const stubs: Readonly<Record<string, string>> = {
  '@/lib/firebase': 'stubs/firebase.ts',
  'firebase/auth': 'stubs/firebase-auth.ts',
  'next/navigation': 'stubs/next-navigation.ts',
  '@/lib/backend/browser': 'stubs/backend-browser.ts',
}
