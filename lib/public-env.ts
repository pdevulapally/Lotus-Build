// Next.js statically inlines NEXT_PUBLIC_* variables only at literal property access sites
// (process.env.NEXT_PUBLIC_FOO). Dynamic bracket access (process.env[name]) is never replaced
// and always returns undefined in bundled client code. All public env reads must be literal here.

function requirePublicEnv(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Missing required public environment variable: ${key}`)
  return value
}

export const FIREBASE_PUBLIC_CONFIG = {
  apiKey: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
} as const
