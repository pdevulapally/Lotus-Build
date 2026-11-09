/** `lib/auth/redirect` reads the app origin at import time; tests that import it set a local default first (imports run in order). */
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
