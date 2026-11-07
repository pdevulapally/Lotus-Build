# LotusBuild security model (frontend + server)

Repositories: `pdevulapally/Lotus-Build` (Next.js 16 / React 19 browser client) and `pdevulapally/lotusbuild-server` (Fastify 5 API, AI runner and deploy infrastructure). The same file is kept in the root of both repositories as `SECURITY_MODEL.md`; update both copies together. It extends the earlier server-only model and keeps its component names. `Lotus-Build/SECURITY_REVIEW.md` is a dependency audit, not a security model. Prior server hardening notes are in `lotusbuild-server/docs/security-remediation.md` and `docs/staging-security-checklist.md`. There is no separate infrastructure repository. Server infrastructure lives in `lotusbuild-server` (`deploy/`, `Dockerfile`, `.github/workflows/ci.yml`, `firestore.rules`, `storage.rules`). **The frontend is hosted on Vercel.** No Vercel configuration is checked in, so its security headers come from `next.config.mjs`.

## Scope decisions (owner-confirmed)

- Server: every asset listed below is critical, every attacker profile is in scope, and **nothing is out of scope or accepted risk**. That includes Free/Pro unrestricted sandbox egress, the agent shell inside its VM, and the open item O02 (API and runner share an OS identity).
- Frontend: the same rules apply, so nothing in the frontend is out of scope, marketing and legal pages included.
- Frontend: **a hostile or prompt-injected generated app running in the preview iframe or desktop stream that attacks the signed-in user's LotusBuild tab is in scope.**
- Consequence: no finding is lowered for scope; every finding is reported at its normal severity.

## System overview and trust boundaries

- **Browser client (Vercel, `www.lotusbuild.co.uk`)**: a client-rendered Next.js app. Firebase browser Auth handles sign-in (Google/GitHub popup, email and password). Every business request goes through `lib/backend/client.ts` to `NEXT_PUBLIC_BACKEND_URL` with `Authorization: Bearer <Firebase ID token>`, `credentials: 'omit'` and `redirect: 'error'`, and responses are validated with zod. The only server route is `app/billing/cancel/route.ts`, a fixed redirect. The client holds no secrets, only public Firebase config (`lib/public-env.ts`).
- **Edge**: Caddy (`deploy/Caddyfile`) terminates TLS for `api.lotusbuild.co.uk`, overwrites `X-Forwarded-For` and proxies to `127.0.0.1:4100`. Fastify sets `trustProxy: 'loopback'`.
- **API** (`lotusbuild-api.service`) and **runner** (`lotusbuild-runner.service`) run on one VPS as OS user `preet`, sharing one `.env` with every server secret. Redis is local.
- **Firebase**: Auth, Firestore and Storage. Client rules are deny-all (`firestore.rules`, `storage.rules`), and all data access goes through the backend.
- **E2B microVMs**: the agent runs arbitrary commands, file writes, previews and a noVNC desktop per session. Free/Pro sandboxes have open egress, and Business is restricted to approved domains. Previews are served from a separate HTTPS origin and embedded in the client.
- **Model providers**: Anthropic (primary) and OpenRouter (fallback), via `src/models/provider.ts`. Voice runs through a WebSocket relay (`src/voice/`).
- **Third parties**: Stripe, Brevo, the GitHub App, and connection providers (Netlify, Vercel, Slack, AWS, MCP; dormant until a KEK is configured).

Trust boundaries: internet → Vercel client and Caddy/API; browser client ↔ preview/desktop origin (agent-controlled content); authenticated user → other users' data; agent and sandbox content (prompt-injectable) → runner, server secrets and other tenants; API/runner → third parties; CI → production VPS.

## Components

| Component | Code it covers |
| --- | --- |
| **Web Client** | `Lotus-Build`: `app/`, `components/`, `contexts/`, `hooks/`, `lib/` (backend client, auth redirects, preview, desktop and voice clients), `next.config.mjs`, `package.json`/lockfile, `.github/workflows/codeql.yml` |
| **API** | `src/server.ts`, `src/http/`, `src/auth/`, `src/users/`, `src/email/`, `src/attachments/`, `src/skills/`, `src/privacy/`, `src/config/`, `src/voice/`, `src/support/` |
| **Runner** | `src/runner/`, `src/sessions/`, `src/models/`, `src/diagnostics/` |
| **Sandboxes & Desktop** | `src/sandboxes/`, `src/desktop/` |
| **Projects & Sharing** | `src/projects/`, `src/storage/` |
| **Billing & Metering** | `src/billing/`, `src/metering/`, `src/entitlements/` |
| **Family** | `src/family/` |
| **Connections & GitHub** | `src/connections/`, `src/github/` |
| **Infrastructure** | `deploy/`, `deploy.sh`, `Dockerfile`, `.github/workflows/ci.yml`, `firestore.rules`, `storage.rules`, `src/preflight.ts`, `src/release.ts`, `src/redis/`, `src/seed/`, `src/firebase.ts`, `src/index.ts`, `scripts/` |

## Entry points and who can reach them

- **Anonymous (client)**: every public page (landing, pricing, help, terms, privacy, login, signup), `GET /billing/cancel` (fixed 303 to `NEXT_PUBLIC_APP_URL`), `/integrations/github/setup` (GitHub redirect with `installation_id`, `state` and `code`; it only acts once the user is signed in), and auth `?next=` redirects through `getSafeRedirectPath` (`lib/auth/redirect.ts`).
- **Anonymous (server)**: `GET /health`, `GET /plans`, `POST /webhooks/stripe`, `GET /shared/projects/:id[/files[/content]]`, `GET /connections/:connector/callback`, and the desktop and voice WebSockets (single-use ticket plus origin allowlist).
- **Signed-in (Firebase ID token)**: `/me*`, sessions (create, messages, SSE events, usage, desktop ticket, voice), projects (files, archive, changes, visibility, share, public preview), attachments, skills, billing checkout and portal, privacy requests, connections, and family. Writes require a verified email.
- **Agent-controlled content reaching the browser**: the preview iframe (`components/project/isolated-preview-frame.tsx`, `preview-with-visual-edit.tsx`, sandbox `allow-scripts allow-same-origin allow-forms allow-popups`, origin and source checked postMessage parsed by `parsePreviewMessage`), the noVNC desktop stream (`components/computer/desktop-panel.tsx`), assistant markdown (`components/ui/markdown.tsx`, `skipHtml`, http/https/mailto links only), file viewers, diffs and terminal output, plus links such as `browserInspection.url`.
- **Agent in sandbox**: tool calls run by the runner. Their output and project content return to the model.
- **CI**: a push to `master` builds an artifact, and `deploy.sh` deploys it over SSH behind the `production` environment approval. The frontend deploys through Vercel.

## Assets and sensitivity (all critical)

1. **Server secrets**: Anthropic, OpenRouter, E2B, Stripe and Brevo keys, the Firebase service account, the GitHub App private key and `CONNECTION_KEK_V<n>`. Highest: compromise affects every tenant.
2. **Sealed connection credentials** (`connection_credentials/*`, AES-256-GCM with KEK-wrapped DEKs) and GitHub App installation tokens: deploy, publish and push access to users' external accounts.
3. **Users' project code and session history**, including attachments and snapshots.
4. **Children's data in family accounts** (UK/EU minors; elevated regulatory sensitivity).
5. **Billing integrity and quotas**: Stripe subscription state, metering counters and holds, plan entitlements. Abuse means free compute and model spend.
6. **User sessions in the browser**: Firebase ID and refresh tokens held by the Firebase SDK (IndexedDB), which give full API access as that user. Draft and pending-command storage lives in local/sessionStorage. This is the frontend route to assets 2–5.

## Attacker profiles (all in scope)

- **Anonymous internet attacker**: public routes, the webhook, shared projects, OAuth callbacks, WebSockets, rate limits, and phishing or open-redirect or clickjacking through client pages.
- **Malicious signed-in user or tenant**: IDOR, quota and billing bypass, sharing abuse, racing idempotency and leases, and serving a hostile shared project or public preview to victims.
- **Prompt-injected agent or hostile generated app**: steers the agent to exfiltrate data or escape confinement. In the browser, it uses preview, desktop, markdown, file or terminal content to run script in, steal tokens from, or act as the LotusBuild origin (in scope).
- **Supply chain / CI**: a compromised npm dependency in either repo, or a compromised workflow.

## Existing controls

- Client: CSP limited to `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` (no `script-src`), `X-Frame-Options: DENY`, HSTS, `nosniff`, a referrer policy, and a permissions policy (`next.config.mjs`). Previews must use a separate HTTPS origin (`lib/preview.ts`). postMessage handlers check `origin` and `source` and validate the payload with zod. Markdown skips raw HTML and filters link schemes. JSON-LD is escaped. Redirects are same-origin only. The backend client omits credentials and refuses redirects. Account-switch guards apply on token use.
- Server auth and HTTP: Firebase ID-token verification with strict bearer parsing and revocation checks (`src/auth/plugin.ts`); verified-email gate on writes; owner checks (`sessions.readOwned`, project repository); global IP and per-uid rate limits backed by Redis, fail-closed (`skipOnError: false`); 1 MB body limit; helmet; exact-origin CORS allowlist without credentials.
- Data: deny-all Firestore and Storage client rules.
- Runner and sandboxes: session lease tokens with expiry fencing; idempotency keys; durable metering holds and reconciliation; per-plan sandbox network policy; validation forks; bounded tool output; descriptor-relative file access and Git-hook defenses.
- Desktop and voice: single-use tickets, WebSocket origin check, tickets redacted from request logs.
- Billing: Stripe webhook signature verification with durable claims.
- Connections: envelope encryption, explicit project grants, lease-token operation ledger, action-bound single-use approvals, OAuth state bound to user, connector and callback with PKCE.
- CI: least-privilege token, pinned actions, build outside the production credential boundary, artifact checksum and revision validation, production environment approval.

## Out of scope / accepted risk

None. Nothing is out of scope for either repository. Documented product choices (Free/Pro unrestricted sandbox egress, the agent shell inside its own VM) and the known open item O02 (shared API/runner OS identity) remain in scope.

## Open questions

- Which Vercel settings are in use (preview-deployment protection, environment variable exposure, custom headers)? This is not visible from the repositories.
- Is a staging environment available to validate findings at runtime?
- Are the GitHub App and connection providers live in production? This affects reachability, not priority.
