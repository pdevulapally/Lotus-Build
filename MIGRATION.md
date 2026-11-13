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
| Voice in a project | GET /voice; GET /sessions/:id/voice-access; WebSocket /sessions/:id/voice | Empty composer waveform connects voice and opens inline controls. No additional checkbox or Start voice button. Browser microphone permission and versioned server policy checks remain |
| Start a new project by voice | POST /projects then /projects/:id/sessions with entrypoint=voice and mode=plan | Creates an idle session with zero messages and no queued task or build charge. Uses the selected server model and durable creation identities, then connects voice at /computer/:id?voice=1. Requires the matching server change before deployment. Public landing unchanged |
| Files / source / ZIP | GET /projects/:id/files; /files/content; /archive | Lazy read-only source, binary/truncation states, ZIP download |
| Repository section | GET /projects/:id/files?ref=branch; /files/content?path=file&ref=branch | Astryx tree table, saved branch browsing and read-only file previews. Workspace ZIP action removed. Branch creation/deletion and full GitHub branch synchronization have not been migrated |
| Repository template toolbar / commit columns | Presentation only for unported data | Table ends at the file list and remains visible when empty. No README/About, section tab row, Add file or Code toolbar buttons. Tags and per-file commits are not migrated: tag control is unavailable, commit values are unknown, and no speculative requests run. See [backend handoff](docs/repository-browser-backend-handoff.md) |
| Repository pull requests | GET /projects/:id/sessions?limit=100; existing session delivery updates | Shows the latest reported delivery for each PR published by those tasks. Repository-wide PR listing, creation, review and merge have not been migrated; GitHub links provide access there. No speculative API requests |
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

- Typecheck, 19 frontend contract tests and production build pass locally. Backend PR #21 Linux CI passed 639/639 tests with no skips.
- Public desktop/mobile rendering, supported mode menu, starter-to-composer interaction, labels, focus and overflow checked locally. The final public landing is at /welcome so signed-in visitors can review it; / opens the authenticated workspace when signed in. This is not a full accessibility certification or signed-in UI test.
- Original reference clone and Git history remain unchanged. No merge, deployment or production mutation is authorized by this PR.

Shared theme: app/globals.css is the single semantic color and font source for the landing, auth, pricing, workspace, project detail and shared portals. Light colors use background #f7f5f3, white surfaces, warm gray #eeeae6, text #262626, muted text #686460, border #d6d0c8 and charcoal #1a1a1a actions. Dark mode uses corresponding warm dark surfaces and light actions. Status and code colors retain their meaning. The retained agent-theme JSON references these tokens rather than maintaining a second palette. Fonts load once from local Fontsource packages at the root layout: Public Sans body and Libre Caslon Condensed 500 display headings; code remains monospace. No runtime Google Fonts request is required. License notices are included.

The public landing follows the inspected Syncrun typography and neutral palette, using LotusBuild software-workspace copy, supplied wordmark, a live composer, and centered lower sections/footer as requested. Chrome was not connected; the same public reference was inspected in the connected browser. No reference text, logos, photos, testimonials or capability claims are used. The software-workspace positioning does not imply desktop automation, deployment, repository import or arbitrary runtime support.

Browser verification: shared fonts/palette were observed on the public landing, sign-in, help and pricing shell. Landing overflow checked at 1440, 390 and 320px. Authenticated project/workspace screens and their dark-mode toggle remain visually unverified with the render-only fake Auth configuration. Pricing correctly exposes a connection failure with no backend at the test origin. A browser-discovered native-fetch receiver bug was fixed and covered by an additional contract regression test; live plans were not loaded.

## Shared public navigation and landing refinement

All public routes (signed-out root, /welcome, /pricing, /help, /terms, /privacy) plus /login and /signup use components/ui/navbar.tsx. Its module owns header geometry, links, active page treatment, account actions, mobile sheet and focus behavior. Shared .site-action and BrandWordmark provide action and responsive logo sizing. The header participates in document flow; obsolete fixed-header offsets were removed from help/pricing. No duplicated landing/auth header remains. The former public account menu's inferred quota display is removed; account usage remains in Settings.

Authenticated project navigation retains its sidebar/mobile working header; computer detail retains its session/editor controls. These are functional product contexts, not alternate public marketing headers, and share global color/type tokens and the supplied mark. Signed-in account menus, authenticated headers and dark mode were source-reviewed but could not be exercised with the fake local Auth configuration.

The lower landing now uses centered paired Plan/Build panels, a unified source/history/download panel, a contrasting closing CTA, and the same maintained centered footer as pricing/help/legal. Existing Plan/Build and brief-focus interactions are retained; design acceptance remains pending. Browser checks verified common desktop header geometry/links across the public pages and loaded auth pages; mobile navigation route-close and Escape focus return, 320/390px landing overflow, 320px signup overflow, and unchanged typed brief after Plan/CTA interaction. No account creation, live generation or billing action was performed.

## Auth diagnosis in the local review preview

The running browser was correlated with its loaded development bundle: it still contained the documented fake Firebase web key/project/auth domain and the unavailable http://127.0.0.1:3199 backend. No real frontend env file or OS public configuration was found in the known checkouts/scopes. Google sign-in reproduced Firebase auth/api-key-not-valid.-please-pass-a-valid-api-key.; the previous generic form copy hid that configuration failure. Login, Google, signup and password-reset forms now use a shared safe provider-error formatter, with regression coverage against leaking raw messages or distinguishing invalid-password/nonexistent-account cases.

The intended live backend https://api.lotusbuild.co.uk was checked without credentials: GET /me returned 401 auth/missing-token; OPTIONS /me for http://127.0.0.1:3107 returned 204 but no Access-Control-Allow-Origin, so that local origin is not currently allowed. No production settings were changed. Actual Firebase sign-in, token validation, authenticated /me models/bootstrap and usage remain unverified. Firebase identity is retained independently of account/usage failures in AuthProvider; consumers render the explicit account error rather than manufacturing account state.

A gitignored .env.local was opened for the user to paste the six actual public Firebase fields locally, with intended app/backend URLs already set. Values are not logged or committed. The old dev-process test variables must be removed and the local preview restarted after the user finishes saving configuration. CORS/provider authorized-domain and provider-enable settings must be verified separately; no wildcard or auth bypass is added.

## Follow-up validation — 2026-10-18

Validated the latest frontend and server rather than reapplying the older migration draft. The workspace layout remains unchanged.

- Expired-token rejections refresh credentials and retry exactly once with the same mutation key/body; uncertain outcomes, revoked credentials and other errors are not automatically retried. A browser client is bound to the account that created it. Account/usage responses must match that identity, and stale account refreshes cannot overwrite newer ones.
- Cancellation identity now survives reload in session storage, scoped to user/session. SSE replay advances only after successful event application, ignores duplicate/older IDs, refreshes expired stream credentials and bounds clean disconnect retries as well as failures.
- Preview frames require a separate HTTPS origin (local HTTP only in local development) and suppress referrers. Visual-edit messages validate their origin/source and bounded payloads. Removed the unreachable same-origin navigation-script injection rather than retaining wildcard messaging.
- All pages deny embedding/object plugins and constrain base URLs; production responses add HSTS without preloading or forcing subdomains. Firebase Auth configuration no longer requires unused Storage/Messaging settings. App/backend origins remain explicit required deployment configuration.
- Frontend TypeScript, 32 contract/security tests and a production build pass with the saved public Auth configuration, explicit app origin and explicit backend binding. Backend TypeScript and all 639 tests pass locally. No lint was run.
- Public preview is disabled by default on the server. Replayed preview links are hidden when the current project says public ingress is off. The frontend does not yet expose owner consent or authenticated private previews; this pass does not enable public ingress or imply that the create/build/preview/reopen flow has been validated live.

Live signed-in validation stopped before account/resource creation because no permitted dedicated verified test login is available. The real API permits the `http://localhost:3000` browser origin; missing test authentication, not local CORS, is the current prerequisite. No personal browser/profile, new account, generation, billing action or production mutation was used to bypass that prerequisite.

Earlier render-only configuration and browser results above describe the upstream baseline, not the follow-up validation. A production health read reports the current server revision; no server settings were changed by this pass.
