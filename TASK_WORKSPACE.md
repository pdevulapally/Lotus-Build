# New agent workspace: first vertical slice

The `/tasks` route replaces retired project/computer flows. It targets the new Python API through `NEXT_PUBLIC_AGENT_BACKEND_URL`, which must be a dedicated HTTPS origin (loopback HTTP allowed for development). Do not point it at the old production backend. No new backend services or provider credentials are embedded in the frontend.

## Implemented

- Firebase sign-in, with current-user capture on API calls and identity-change reset. New routes do not request legacy `/me` or `/me/usage`; they do not display invented plans or balances.
- Create code/desktop tasks, reopen by session ID, and display saved text messages and explicit server state.
- Poll canonical session snapshots while queued/running/stopping, with bounded retry and manual refresh. This is not token streaming or replayable SSE.
- Display the exact pending tool batch. Every risky call requires explicit approve/deny; non-risky calls that will resume are visible. Approval ID and individual call IDs go to the server. Decisions do not imply blanket future authorization.
- Cooperative cancellation, with a stopping state rather than an optimistic claim that execution has ceased.
- Interrupted-effect warning; recovery-required sessions cannot accept follow-up messages.
- Stable user/session-scoped mutation identities in sessionStorage across uncertain retries/reloads. Task/message text is retained only while its submission is uncertain; no bearer tokens are stored. Sign-out does not make one user's pending request accessible to another account's client.
- Separate API runtime validation, strict origin configuration and no cookie credentials/redirect following.

The exact backend contract is in the new backend's API.md. The old client, legacy adapters and old account/bootstrap calls have been removed. Current Firebase email verification gates the new route locally; backend authorization remains the actual security boundary and must enforce required policy independently.

## Known boundaries

This is a replacement workspace review build, not the full redesign or a production release. There is no task list endpoint yet, so reopen uses a task ID/bookmarked URL. Files/artifacts, connector settings, schedules, memory, streamed deltas and live desktop are deliberately not shown as connected capabilities. Persisted transcript compaction and execution permissions still depend on backend follow-up work.

This patch has not been tested against a live Firebase/E2B/Python deployment. Test providers use dummy values only. A clean staging end-to-end check must verify authentication, cross-user denial, submit/retry/approve/cancel, refresh/account change and actual server restart behavior before release. Run `npm run typecheck`, `npm run test:contracts` (with dummy Firebase public config for existing tests), and `npm run build` (with all required public environment values).

## Current UI direction
A cooler neutral task/account canvas replaces the previous warm grid treatment. Approvals reflect server-classified permission boundaries only; the frontend does not classify arbitrary file edits or reduce backend protections. Exact tool inputs are expandable, and the main view presents saved conversation and meaningful task state. No fabricated progress percentages or simulated activity.

## Reconciliation and ordering
An uncertain submission keeps its original key and payload. The separate **Resolve pending request** control remains available even when an approval batch is no longer visible; it replays only that recorded command. A successful receipt clears pending identity, but its cached snapshot is not treated as current state: the workspace reads the canonical session again. First-attempt definitive input/auth rejections and known precondition conflicts allow correction; unknown conflicts and every failed replay retain the original uncertainty. Corrupt records or unresolved fingerprint conflicts require operator investigation, not a new-key workaround.

The API factory checks the hook's expected Firebase UID before capturing credentials and rechecks account identity after token retrieval. Reads started before a mutation are invalidated using a local epoch, and polling is paused while a mutation is submitting. Poll retry failures are bounded (four failed reads, exponential delay up to 12 seconds), with manual refresh afterward. Unit/source-contract tests cover these guards; mounted-browser timing remains a staging gate.
