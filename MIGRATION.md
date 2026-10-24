# FastAPI frontend replacement — review build

The frontend now uses `NEXT_PUBLIC_AGENT_BACKEND_URL` through `lib/backend/client.ts` and the new task client. The old backend transport, schemas and adapters are removed. Firebase browser Auth remains unchanged as the identity provider; no credentials or Firebase security configuration changed.

## Supported surface
- `/tasks`: create code/desktop tasks, reopen by ID, poll saved status/transcript, review exact approval requests, request cooperative stop, show interrupted recovery state.
- Firebase sign-in, sign-up, password-reset and verification-link SDK flows. Application authentication no longer fetches a legacy account or usage record.
- `/settings`: actual Firebase identity, password reset and sign-out only.

## Removed/unavailable features — not silently migrated
| Previous feature | Replacement behavior |
| --- | --- |
| Project list/create/rename/delete and workspace switcher | New task entry; no task listing endpoint yet. |
| `/project/:id`, `/computer/:id` | Non-destructive retired-link notice; no old server calls and no automatic ID conversion. |
| Old build/plan model chooser, effort presets, queued messages | New API code/desktop task and idle follow-up contract only. |
| Attachment upload/download, terminal stream, file tree, version history, preview/browser/noVNC desktop | Removed from live workspace; not represented as connected. |
| Old custom email-code service | Firebase verification links, user-triggered send and reload/refresh-token check. |
| Pricing/checkout/billing portal, subscription/usage balances | Explicit unavailable notices. Existing subscriptions are NOT cancelled or changed. |
| GitHub connections, schedules, memory, deployment | Not wired into this frontend slice. |

No production data, old repositories, stored sessions, subscriptions or VPS services were deleted or changed. This removes frontend integration code only. Old IDs must not be treated as new session IDs. Data migration/export and subscription-management transition require separate work before cutover. Keep the old service/backups available for that migration plan; this review build is not a deployment authorization.

Marketing examples remain labeled illustrations of product direction, not live capabilities. Landing entry now navigates to the new workspace rather than calling the old build API. The landing visual refresh is a separate scoped component change.

## Validation and remaining gates
Retired adapter tests are replaced by new task contract, no-stale-runtime-origin, Firebase identity/verification, redirect, markdown, preview isolation and header regression checks. Dummy configuration and mocked HTTP only. No live sends or sandbox execution. Run typecheck, test:contracts and build before release. Browser-rendered QA and staging end-to-end behavior remain unverified due environment restrictions. Static HTML previews render actual React components with illustrative data, not a live integration.

Retired-only noVNC, Monaco and QR-code dependencies were also removed. The lockfile was regenerated with install scripts disabled; no broad dependency upgrades were requested. Existing generic UI components and static assets were retained.
