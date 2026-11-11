LOTUSBUILD: PROJECT CONTEXT AND HANDOFF

You are helping Preetham Devulapally build LotusBuild. Treat this handoff as context, not a substitute for inspecting the current code, Git history, configuration and production behavior. PR metadata below was checked on 11 November 2026; verify it again before acting. Do not assume a green build proves a feature works for customers.

PRODUCT VISION

LotusBuild is an AI-powered software-building platform, with a persistent project workspace and an autonomous coding agent. Preetham wants an experience comparable in capability and responsiveness to Codex, Devin, Cursor, Lovable and v0, while retaining LotusBuild’s own identity.

The agent should understand the request, inspect the project, choose and use tools dynamically, edit files, run and debug software, inspect results and recover from failures. It should not follow a hardcoded sequence of steps or claim success without evidence. It should ask useful questions when necessary and resume safely after interruption.

The product should show meaningful progress and outcomes, with expandable technical detail rather than a stream of low-level file-write chatter. Stop is a normal user action, not a failure. Preserve task and workspace state across stopping, recovery and sandbox lifecycle changes. Do not retry an external action if its previous outcome is uncertain without checking it first.

A project owns its environment. Provision the sandbox and desktop when needed rather than starting everything automatically. Plan, Build and Auto have distinct purposes; Auto should allow building without a separate plan approval, while consequential-action boundaries remain enforced by the system.

The backend, not just the prompt, must enforce authentication, authorization, tenant isolation, permissions, budgets, cancellation and safe stopping.

HOW PREETHAM WANTS YOU TO WORK

Work like a senior engineer: inspect the real implementation and current branch before proposing or writing code. Separate verified facts from assumptions; challenge weak ideas and double-check important claims. Consider edge cases, security, backward compatibility, tests, integrations, maintainability and regressions. Prefer KISS and reuse existing shared logic instead of duplicating accounting, authentication, state or queue mechanisms.

Make sensible routine decisions using the established product context. Ask when an important business, security or cost decision is unresolved, authorization is required, or essential information is missing. Keep updates concise and concrete. Preetham wants the work implemented and verified, not just a prompt or a collection of files, unless he asks for those.

A merge of the backend can automatically trigger deployment. Do not treat merging as housekeeping or assume permission to merge, deploy, change production configuration, activate payments, spend money or contact another agent. Verify what is authorized for the current task.

REPOSITORIES AND ARCHITECTURE

Frontend: https://github.com/pdevulapally/Lotus-Build
Active Node.js backend: https://github.com/pdevulapally/lotusbuild-server
Paused Python replacement: https://github.com/pdevulapally/lotusbuild-pythonapi-newbackend
Application: https://www.lotusbuild.co.uk

The active product uses a Next.js frontend on Vercel and a separate Node.js/TypeScript backend API and runner on a VPS behind Caddy. Existing service names include caddy, lotusbuild-api and lotusbuild-runner. Firestore is used for durable records, authoritative configuration, queue/claim state and transactional leases. Redis supports streaming/SSE replay; do not assume it is the durable job queue. The backend includes model admission, reservations and settlement, sandbox/desktop/preview and project snapshot paths, GitHub integration, Stripe subscription and prepaid-credit code.

Daytona has been the intended sandbox direction, but verify the actual active provider and configuration rather than assuming rollout succeeded. When authorized to access the VPS, an established SSH alias is lotusbuild-vps. Verify the environment and identity before using it.

On 31 October, Preetham chose to continue with the Node backend and preserve the Python replacement for later. Do not restart the Python replacement or overwrite old local work without a new request. Its published experimental checkpoint is branch codex/fastapi-autonomy-foundation-20261025, commit eaf8e63aedca38df515e11077a40ac06281cb15b; it is not a verified production replacement. Later local work may not be included there.

RECENT MERGED WORK AND WHAT IT DOES NOT PROVE

Backend PR #112, https://github.com/pdevulapally/lotusbuild-server/pull/112, merged 10 November as 4f19b0438be4f899784735de3faaa4be26860b35. It integrates agent reliability changes including shared thinking/output ceilings, admission, truncated tool-call protection, preview/desktop recovery, evidence-based completion, tool contracts and plan/question integrity. Its production workflow succeeded with artifact and health checks. One live structured question-and-wait path worked, but this does not prove the entire agent experience or provider integration. Some instruction/tool changes invalidate older paused-continuation fingerprints; preserve those guards. A new Free persistence seed does not itself migrate existing persisted plans or restore previously discarded data.

Backend PR #114, https://github.com/pdevulapally/lotusbuild-server/pull/114, merged and deployed a session-usage fix. Keep session-lifetime usage, monthly account quota, reservations, settled consumption and daily pacing distinct; do not double-count them.

Backend PR #115, https://github.com/pdevulapally/lotusbuild-server/pull/115, merged and deployed a read-only subscription summary. It is not by itself a complete wallet or payment flow.

Backend PR #116, https://github.com/pdevulapally/lotusbuild-server/pull/116, merged and deployed prepaid-credit wallet and checkout code. A deployed API and successful health check do not prove the catalog is configured or that customers can purchase.

Frontend PR #74, https://github.com/pdevulapally/Lotus-Build/pull/74, merged on 11 November as 342bf28bfd6fab8b11fbffc8e32cde5799760d62. It rebuilds billing navigation, makes on-demand usage more discoverable and handles calendar-expiry validation. Production bundles were verified to contain the new code. Signed-in desktop/mobile visual and interaction QA remained blocked by login, so actual authenticated behavior was not verified.

BILLING AND ON-DEMAND USAGE

Preetham wants a clear, modern, accessible Plan & Billing and Usage experience, with on-demand purchases easy to find. He explicitly objected to on-demand being buried and to superficial pill-shaped buttons being treated as a complete design. He provided Claude screenshots as references. Verify the entire desktop/mobile journey, including account-menu entry points, unavailable-service handling and Stripe return, rather than checking controls individually.

On 10 November he accepted a proposal: Free and paid users can top up; included usage is consumed first; purchased allowance expires after 12 months; £5 for 500,000 and £15 for 2 million were described to him as “tokens.” This creates an unresolved commercial/technical mismatch: the implementation uses weighted unified AI credits, which are not necessarily equivalent to raw model tokens. Do not silently convert the accepted terms or promise raw tokens when the system sells weighted credits. Resolve quantities and customer-facing wording before making offers sellable.

He said he does not currently have Stripe test keys. Simulated tests do not prove real Stripe checkout. Tax treatment, credit pacing, Stripe prices and configuration, real checkout and webhook/reconciliation tests, and production activation remain open. Do not infer automatic recharge, recurring subscriptions, tax-inclusive pricing or permission to charge.

Backend PR #117, https://github.com/pdevulapally/lotusbuild-server/pull/117, was still an open draft when checked. Head 4797a783b7ea9a03d79b643e2944926425ad57a5. It implements calendar-month expiry with month-end/leap-day handling while preserving legacy fixed-duration and non-expiring offers. Its final CI passed. The unresolved pack terms remain non-sellable; it was not deployed. Before activation, check frontend compatibility, ownership, replay/idempotency, refunds/reconciliation, tax, terms and real Stripe testing.

A smart mid-cycle upgrade and a cinematic welcome displaying the purchased plan were requested but remained unfinished. Treat these separately from enabling top-ups.

HELD TEAMS AND ACCOUNT-LIFECYCLE WORK

Backend PR #102: https://github.com/pdevulapally/lotusbuild-server/pull/102
Frontend PR #67: https://github.com/pdevulapally/Lotus-Build/pull/67

Both were open drafts at the last check and have diverged from newer master work. They cover Teams/workspace, subscriptions and seats, account lifecycle and feed reliability. Recompose against current bases and rerun integrated cross-feature tests; old green CI on historical heads is not release readiness. Backend changes overlap later wallet/billing work, so preserve subscription behavior, purchase fulfillment and replay, organization-owner protections and account-erasure guards.

Required production Firestore indexes for projects(workspaceId ASC, createdAt DESC) and accountClosures(status ASC, closesAt ASC) had not been verified Enabled. Application deployment and /health do not establish index readiness. Verify separately before release; inspecting an index is not permission to deploy one. A skills(ownerUid, name) index also needs its own verification before calling Skills recovery complete.

Do not activate a priced Teams configuration against an incompatible server or use a broad seed overwrite that could replace unrelated registry/plan edits. A £40/seat monthly, two-seat-minimum value appeared in proposed code; it was not established as approved live pricing.

SECURITY AND TRUST BOUNDARIES

Backend PR #113, https://github.com/pdevulapally/lotusbuild-server/pull/113, was an open draft for multimodal/metadata and prompt-injection defense in depth. It includes provenance and validation work but is not prompt-injection immunity: malicious instructions can remain in image pixels, transparency or animation. Metadata changes can affect image rendering. Review old paused-continuation compatibility when system instructions change.

Historical source reviews raised GitHub integration questions about installation access versus the authenticated user’s repository access, revalidation of connections, installation-wide clone credentials, credentials inside user-controlled sandbox paths, and local-commit guards. These were source-level risks, not proof of exploitation or credential theft. Inspect current code and authorization before asserting they remain or are fixed. A previously prepared hardening fix was not established as published.

Historical recovery/accounting review also identified potential stale-worker and late-usage settlement interleavings after lease expiry. This was not evidence of double charging. Test concurrent and late settlement explicitly, separating observed code behavior from approved charging policy.

DMARC: on 11 November, Google and Cloudflare DNS returned NXDOMAIN for _dmarc.lotusbuild.co.uk. No DNS change was made. Nameservers ns1/ns2/ns3.livedns.co.uk are consistent with Fasthosts or a reseller, but the account controlling the zone is unconfirmed. The question asking Preetham where DNS is managed is already pending. Recheck DNS, identify the legitimate senders and verify SPF/DKIM alignment before enforcing a policy. A p=none record does not prevent spoofing, and without a reporting destination it does not collect reports. Do not invent a domain mailbox or reporting recipient.

FREE PLAN, ACCOUNTING AND MODEL CONTINUATION

Preetham reported that Free usage could be exhausted by a greeting followed by a build. The actual cause has not been established. Investigate effective live allowances, model usage, reservations, settlement, daily pacing and persistence before altering quotas. Historical proposed allowances or seed files are not proof of current or approved pricing. A test-only PR #103 uses illustrative assumptions, not real customer usage.

Free continuation was discussed with explicit notice and acceptance, a separate bounded allowance, lower-priority fair queue, preserved task state and cancellation. Avoid silent unsafe model switches mid-action. Later code targeted NVIDIA minimaxai/minimax-m3.1-flash instead of an earlier OpenRouter approach, but deployed credentials, configuration and end-to-end user consent remained unverified. Do not advertise it as ready based on a single tool-call test.

SANDBOX, DESKTOP, PREVIEW AND PERFORMANCE

Daytona/provider-neutral work, cancellation and snapshots were developed in earlier PRs. A production Daytona session was reported with preview and desktop problems; a smoke test or diagnostic PR is not proof the complete user flow works. Verify the serving revision and actual provider, process cancellation, desktop and preview, saved-file restore, reconnection, mobile behavior, isolation, signed-link exposure and expiry, quotas, lifecycle cleanup, costs and rollback. Do not assume a paused sandbox has no storage cost.

Preetham wants immediate workspace transition and a reusable Lotus logo loader, but do not trade away authentication, accounting or durability. Measure navigation, APIs, queue, first useful output, tool actions, save and rendering separately. Historical latency measurements and earlier fixes are not proof of current performance.

INTEGRATIONS

Users should connect their own AWS, Netlify, Vercel, Firebase and other provider accounts where applicable, with users paying providers directly. MCP should expose agent-facing tools; OAuth handles authorization and Skills describe workflows without granting permissions. Prefer official services or controlled adapters, narrow/revocable scopes, server-side secrets and clear preview/production boundaries. Netlify integration was requested, but verify its present scope and implementation.

DESIGN AND BRAND

LotusBuild’s name has a personal connection to Maa Lakshmi and the lotus. The product should feel bold, modern, distinctive and developer-first, with a professional, simple visual language. Avoid generic AI sparkle/neon aesthetics, oversized logos, game-like smoke or grain, unnecessary gradients and decorative redesigns. Use existing custom SVG icons and consistent design tokens; support light and dark modes and mobile. Pill buttons are a detail, not a substitute for usability.

Be honest about previews: prior cloud Chromium could show a static fallback rather than actual WebGL animation. A professional landing-page demo video was requested for later, not as the current priority.

COMPANY AND LEGAL BACKGROUND

Preetham said SR IT SUPPORT SERVICES LTD is authorized to operate LotusBuild and owns or licenses the platform IP. He identified both consumers and businesses as intended customers and said lotusbuild.support@gmail.com works. These are user-provided statements, not independent legal or mailbox-monitoring verification. Target countries, notices, retention, provider agreements and billing/legal readiness still need review as relevant.

WHERE TO START
1. Ask what specific task Preetham wants done now. Do not blindly execute this entire backlog.
2. Inspect current repository state, branch, dirty files, PR heads, production configuration and existing tests before changing anything.
3. For billing work, verify signed-in desktop/mobile behavior and the unavailable-service flow; reconcile credit units and commercial terms before enabling purchases.
4. For held releases, rebase/recompose safely, test cross-feature interactions and verify the required indexes separately.
5. For agent work, test actual tool choices, Stop/recovery, persistence, preview/desktop and provider behavior. Distinguish code, deployment and real customer outcomes.
6. Report what is verified, what remains unknown, the smallest coherent fix, tests and any production or user action required.