# Dependency security review

Inspection date: 2026-10-17. The previous install reported 13 advisories including critical Next.js findings. After removal of obsolete server packages and focused compatible updates, npm audit reports zero vulnerabilities. This does not establish application security, native-runtime security, or successful authentication/provider integration.

| Group and dependency path | Previous affected version/range | Locked version / action | Exposure and applicability |
| --- | --- | --- | --- |
| Next.js (direct; also analytics peer) | 16.2.9; multiple advisories through <16.3.8 | 16.3.8 exact | Actual Next server and Windows dev server. Windows-hosted RCE is relevant to local Windows hosting; production host not verified. Image optimization is disabled and next/og ImageResponse is not used in this app, which narrows those specific vectors but does not remove the need to patch. |
| Firebase → Firestore/compat → grpc-js | 1.9.16; authentication-context/error-disclosure advisories <1.13.6 | Override 1.13.6 | Installed via the Firebase umbrella SDK; no Firestore import or gRPC server/getAuthContext use in frontend source. The override crosses Firestore's ~1.9 constraint within gRPC major 1; browser Auth build passes but real Firebase sign-in remains unverified. Retest real sign-in before release. |
| grpc-js / proto-loader → protobufjs | Affected 7.5.0–7.6.4 | 7.6.6 through existing compatible range | Proto-option parser DoS. No user .proto parsing in this frontend; retained transitive dependency still patched. |
| Tailwind/PostCSS → postcss; direct postcss/autoprefixer | Prior lock had affected <=8.5.22 versions | postcss 8.5.30; @tailwindcss/postcss 4.3.3 | CSS/source-map file disclosure in build tooling. Frontend builds repository CSS; arbitrary generated projects are executed by the separate server, not this app. CI/supply-chain inputs still matter; dev classification is not a dismissal. |
| autoprefixer → browserslist → baseline-browser-mapping | browserslist <=4.28.6; baseline >=2,<2.11 | 4.29.3 / 2.11.29 | Build-time unbounded query cache, invalid custom stats/prototype writes, and process termination. No web endpoint accepts Browserslist inputs; trusted-build assumptions remain a boundary. |
| Tailwind/PostCSS → source-map-js | 1.0.0–1.2.1 | 1.2.2 | Indexed source-map event-loop DoS during tooling use. Patched instead of accepting a development-only exemption. |
| Earlier nanoid and sharp paths | Removed/updated with legacy dependency removal and Next update | No remaining audit finding | No blanket major upgrade or force audit fix used. |

Primary advisories:

- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
- https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4
- https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j
- https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp
- https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx

The lockfile is authoritative for exact transitive versions. Validation includes typecheck, contract tests for auth headers/validation/response failure/idempotency, and a production build with fake public render-only config. No exploit attempt, external penetration test, real payment or real provider generation was performed. Keep the PR draft while functional migration/live verification gaps in MIGRATION.md remain.
