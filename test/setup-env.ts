// Contract tests import modules that read public build-time env at load; supply the local origin when unset.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000"
