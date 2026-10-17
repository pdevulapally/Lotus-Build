# Current-server frontend migration

This checkout is a frontend for the separate lotusbuild-server. It contains no application API handlers, legacy proxy, Firebase Admin SDK, AI provider client, billing server SDK, or E2B runtime/template. Application data uses the explicit NEXT_PUBLIC_BACKEND_URL origin through lib/backend/client.ts; there is no /api prefix on that server. Firebase browser Auth remains for authentication only.

## Control-to-contract inventory

| Surface/action | Current contract | Implemented state |
| --- | --- | --- |
| Sign in and account | Firebase browser Auth; GET /me and /me/usage | Explicit auth/account failures; no direct business Firestore access |
| Public draft | Session-only validated prompt and Build/Plan mode | Restored after sign-in; no guessed model or automatic paid build |
| Workspace model | GET /me models catalog | Only returned IDs/names; model stays fixed in an existing session |
| Session modes | build / plan on session creation | No Smart/Auto/Ask or platform selector; server owns project type |
| Create | POST /projects then /projects/:id/sessions | Stable persisted keys across uncertain responses/reload |
| Continue / approve plan | POST /sessions/:id/messages, optional mode=build | Durable message identity; mode changes only after an idle plan |
| Stop | POST /sessions/:id/cancel | Stable key across uncertain cancellation |
| Reopen / transcript / queue | GET /projects/:id/sessions; /sessions/:id; /messages; /queued-messages | Validated data and explicit access errors |
| Live activity | GET /sessions/:id/events | Bearer header, Last-Event-ID, bounded reconnect, no tool input/source disclosure |
| Files / source / ZIP | GET /projects/:id/files; /files/content; /archive | Lazy read-only source, binary/truncation states, ZIP download |
| Saved history / diffs | GET /projects/:id/changes and /changes/:sha | Read-only history/diff; no pretend restore |
| Per-session usage | GET /sessions/:id/usage | Settled and open meter quantities; never shown as context-window occupancy |
| Project rename/delete | PATCH/DELETE /projects/:id | Current server owns authorization and mutations |
| Pricing / checkout / portal | GET /plans; POST /billing/checkout and /billing/portal | Server prices and plan keys; no fallback quotas/prices |
| Erasure request | POST /me/privacy-requests | Request acknowledgement is distinct from completed deletion |

## Removed legacy material

- All 59 app/api route files and the temporary retired-backend copy; proxy.ts and instrumentation.ts.
- .npmrc (legacy-peer-deps); normal npm installation succeeds without it.
- scripts/generate-template-package-json.mjs and template:prepare.
- e2b-template/package.json, e2b-template/baked-manifest.json, e2b.Dockerfile, e2b.toml.
- Unreferenced server auth/Admin, generation/provider, metering, rate-limiting, environment encryption, old integration, snapshot/version service and orchestrator libraries.
- Obsolete server dependencies and old model/mode/platform choices. Pure frontend types/helpers and existing component/layout structure remain where referenced.

Necessary JSON retained: package.json/lockfile, tsconfig.json, components.json and app/theme.json (frontend tokens). Public Firebase Auth configuration is required; provider/payment/Admin credentials belong only in the current server. The firebase umbrella package still installs Firestore transitively; the frontend never imports it. Its gRPC dependency is patched through a documented override.

## Explicit remaining gaps — draft PR

A full feature migration is NOT complete. Current server desktop relay/viewer, project visibility/shared-project UI, family sharing and owner activity feed are not connected here yet. Publishing, external GitHub/Supabase integrations, project-secret editing, teams, editable memory, invoice listing, conversation editing, checkpoint restore, old guided-options generation and mobile runtime need separate reviewed contracts/ports. Unported controls, panels, marketing claims and route links are removed from launch UI; future ports belong in this document. Genuine runtime failures remain explicit. Support uses the existing email link; contact-form delivery is not ported.

No real authenticated create-to-session, provider generation, Stripe, Firestore, VNC, or live production verification was performed. Local preview/build use an explicitly fake public Firebase configuration solely to render signed-out UI. Do not deploy those values. Deploy the reviewed backend receipt support before using mutation retries with this frontend.

## Verification

- Typecheck, 18 frontend contract tests and production build pass locally. Backend PR #21 Linux CI passed 639/639 tests with no skips.
- Public desktop/mobile rendering, supported mode menu, starter-to-composer interaction, labels, focus and overflow checked locally. The final public landing is at /welcome so signed-in visitors can review it; / opens the authenticated workspace when signed in. This is not a full accessibility certification or signed-in UI test.
- Original reference clone and Git history remain unchanged. No merge, deployment or production mutation is authorized by this PR.

Shared theme: app/globals.css is the single semantic color and font source for the landing, auth, pricing, workspace, project detail and shared portals. Light colors use background #f7f5f3, white surfaces, warm gray #eeeae6, text #262626, muted text #686460, border #d6d0c8 and charcoal #1a1a1a actions. Dark mode uses corresponding warm dark surfaces and light actions. Status and code colors retain their meaning. The retained agent-theme JSON references these tokens rather than maintaining a second palette. Fonts load once from local Fontsource packages at the root layout: Public Sans body and Libre Caslon Condensed 500 display headings; code remains monospace. No runtime Google Fonts request is required. License notices are included.

The public landing follows the inspected Syncrun typography and neutral palette, using LotusBuild software-workspace copy, supplied wordmark, a live composer, and centered lower sections/footer as requested. Chrome was not connected; the same public reference was inspected in the connected browser. No reference text, logos, photos, testimonials or capability claims are used. The software-workspace positioning does not imply desktop automation, deployment, repository import or arbitrary runtime support.

Browser verification: shared fonts/palette were observed on the public landing, sign-in, help and pricing shell. Landing overflow checked at 1440, 390 and 320px. Authenticated project/workspace screens and their dark-mode toggle remain visually unverified with the render-only fake Auth configuration. Pricing correctly exposes a connection failure with no backend at the test origin. A browser-discovered native-fetch receiver bug was fixed and covered by an additional contract regression test; live plans were not loaded.
