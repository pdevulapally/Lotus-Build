# Agent feed latency — 6 November 2026

## Confirmed causes and changes

- Startup previously awaited session/history/queue, then project, before calling the event follower. The follower immediately repeated reconciliation before connecting SSE. It now opens the authenticated stream alongside one initial hydration. Reconnects reuse an outstanding reconciliation; replay ordering, acknowledged cursors, token refresh and retry policy remain in place.
- Project lookup previously waited for unrelated history and queue requests. It now follows the session lookup directly. The owned workspace renders once session and project are available; conversation hydration and the optional file listing continue independently.
- Parallel streaming requires guarding late snapshots. Request versions reject superseded HTTP results; stream-state and text revisions protect newer updates. Changed authoritative snapshots still reconcile history, and a completed live response stays visible until saved history catches up. Account/session changes mask the previous scope immediately and abort its connections and requests.
- `agent.step` was ignored by the canonical feed, leaving generic working copy. It now supplies a safe processing label with no step payload, reasoning or tool arguments. Confirmed lifecycle/tool events drive current status. A running tool or streamed answer replaces the generic indicator. Initial startup says “Starting your request…”, rather than exposing `QUEUED`. Follow-up messages waiting behind active work retain their existing queue presentation.
- Ending a session previously marked every outstanding tool successful. Unanswered tools now remain interrupted. Results match their tool name and call ID, with a name-matched fallback for legacy events. Failed/interrupted commands and file edits no longer use successful presentation or successful diff counts.
- The composer already had a synchronous duplicate-submission guard and durable project/session mutation keys. These remain intact. A visible submitting notice acknowledges the action; submitted text and attachment controls stay locked until acceptance or failure. Pending attachment references now restore after refresh. Navigation starts immediately after confirmed acceptance, ahead of draft cleanup.
- The runner held the first model text behind a 250 ms coalescing timer. The first nonempty chunk now enters the existing serialized durable-event write chain immediately. Subsequent chunks retain the 250 ms batching window, size bounds and flush-before-lifecycle ordering.
- The canonical feed re-rendered every row and re-parsed every markdown block on each streamed-text frame. Feed rows (`FeedItem`, `UserMessageBubble`, `Markdown`) are now memoized; page-supplied callbacks reach them through stable trampolines that invoke the latest prop. The streamed response splits at blank-line boundaries outside code fences, but never where the following line could continue a blockquote, list or indented continuation — that would turn one construct into two (`splitStableBlocks`). Document-scoped reference definitions are re-parsed with every block so links still resolve. Only the in-progress tail re-parses each frame; rendered markup is unchanged, verified by unit tests and a react-markdown unsplit-vs-split HTML comparison covering reference links, loose and nested lists, blockquotes, fences, GFM and incomplete input.

## Browser measurement (production build, real Chrome, synthetic events)

A temporary route drove the real `AgentFeed` through the hook's real event reducers: 150 feed events, 24 saved messages, 40 000 streamed characters at the server's 200-char durable-write cadence. Chrome headless via CDP; dispatch→layout-effect commit latency and `longtask` entries measured in-page.

| Scenario | Before | After |
| --- | ---: | ---: |
| Commit median | 93.8 ms | **11.7 ms** |
| Commit p95 | 185.2 ms | **18.4 ms** |
| Commit max | 222.5 ms | **29.5 ms** |
| Long tasks during stream | 108 (12.4 s total) | **0** |
| Commits during stream | 112 | **202** |
| Full-history remount | 368 ms | 371 ms (unchanged, one-time) |

Every streamed delta now commits within the frame budget; before, the saturated main thread dropped ~45% of deltas. These numbers measure the render path only — they are not summed with the transport timings above and do not claim an end-to-end figure.



No combined creation endpoint was introduced: the available evidence does not establish that its transactional complexity is justified. No provider, admission, billing, approval, plan-mode, resource-allocation or sandbox-laziness contract changed. There is no premature environment allocation or fabricated activity.

## Measured result

Existing backend audit, repaired to use the current `runner.start()` polling interface; controlled-text samples increased from 3 to 20. Command in the server checkout:

```powershell
node --experimental-strip-types scripts/latency-audit.ts <output.json> 1
```

Twenty sequential samples per version, Node v24.16.0, in-memory Firestore/Redis/Auth and a synthetic model stream. No production, provider, Caddy or external network calls. The controlled model emits text, then stays open for 500 ms so completion cannot flush away the batching delay under test.

| Model text callback → first durable text event | Before | After |
| --- | ---: | ---: |
| Median | 253.963 ms | 0.717 ms |
| p95 | 266.240 ms | 1.650 ms |
| Samples | 20 | 20 |

Raw summary: `../lotusbuildbackendserver/docs/agent-feed-latency-20261106.json` (sibling checkout).

The removed HTTP startup dependency and earlier workspace rendering are confirmed by deferred-request regression tests. Their end-to-end median/p95 gains have **not** been measured in a production browser. The table measures the batching change only and does not establish parity with another product.

## Instrumentation and limitations

`lib/backend/latency.ts` records bounded, local `performance.measure()` entries named `lotus.*`. It sends no telemetry and records no prompt, token, credential, argument, account ID or session ID in measurement entries. In-memory trace lookup is account/session scoped, capped at 32 traces with a 30-minute lifetime; measurement entries are bounded at 200.

Client monotonic intervals: submit to acknowledgment commit, acceptance and navigation; navigation to workspace commit and SSE open; first received model-activity event to feed commit. A React commit is not proof that the browser has painted. Refreshes/direct visits have no invented submit/navigation timestamp.

Separate `lotus.journal.*` durations use only timestamps within the server journal, including the initial accepted session's server `createdAt`: acceptance to `session.running`, running to `agent.step`, and first tool request to `sandbox.started`. These may be replayed events, are wall-clock observations and are not client network latency. `session.running` confirms runner startup, not the exact claim instant. `agent.step` precedes model admission; it does not assert that a model token has arrived. `sandbox.started` confirms acquisition, before workspace restore/desktop readiness; no provisioning-start event is invented.

The backend also emits `runner.claim_to_model_step` through its existing monotonic diagnostic timing sink; existing model-first-text, generation, sandbox acquisition and event timings remain available. Spans ending without a step have `ok: false`. Exact acceptance-to-claim queue residence and fleet-level median/p95 require deployment traces; no storage contract was added to manufacture them.

Inspect local measurements in browser DevTools without exporting customer content:

```js
performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('lotus.'))
  .map(({ name, duration }) => ({ name, duration }))
```

## Verification

- Frontend `npm run typecheck`: passed.
- Frontend `npm run test:contracts`, with the existing `.env.local` loaded into the test process: 134/134 passed. The plain command initially failed because Node tests do not load Next.js environment files. No environment values were changed or printed.
- Frontend production build: passed (final repeat after the last changes recorded in the task report).
- Backend typecheck/build: passed.
- Focused runner cancellation, desktop and durable event tests: 55/55 passed.
- Full backend suite: 730 passed, 108 failed, 1 skipped. An isolated untouched HEAD checkout: 729 passed, the **same 108 named failures**, 1 skipped. The added first-chunk test accounts for the extra passing test. Existing failures include workflow/shell, Git-restoration fixtures and workspace-salvage fixtures. The temporary baseline checkout was removed.
- SSR feed checks cover initial startup copy, safe processing, streamed text, no duplicate activity indicator, and failed/interrupted tools. Deterministic effect tests exercise the real hook's request/event callbacks, stale snapshots, early events, bounded activity history, cancellation, account/session masking and cleanup. These do not replace browser integration testing.
- `git diff --check`: passed in both checkouts. Neither package defines a lint script.
- Browser rendered/device/animation profiling remains unverified: both browser-host connection attempts returned “The browser access host is unavailable”. No feed sort/memoization rewrite was made without profiling evidence.
- Production runner/transport/model timing, real attachments, network loss, reconnect after deployment, plan approvals, follow-ups and paid/provider integrations require live validation. No production data was written and nothing was staged, committed, pushed or deployed.

## Files changed

Frontend:

- `app/computer/[id]/page.tsx`: feed label and workspace/feed timing commits.
- `components/computer/agent-feed.tsx`: confirmed activity and truthful tool outcomes.
- `components/project/bash-tool.tsx`: pending/error/interrupted command presentation.
- `components/ui/animated-ai-input.tsx`: submission feedback, locking, restored references and acceptance timing/navigation.
- `components/ui/attachment-strip.tsx`: locked removal and restored references without broken thumbnail URLs.
- `hooks/use-backend-session.ts`: concurrent startup, stale-result guards, event status projection, response handoff and scoped cleanup.
- `hooks/use-composer-attachments.ts`: restore persisted references.
- `lib/backend/feed-labels.ts`: safe event-derived progress copy and readiness labels.
- `lib/backend/session-events.ts`: nonblocking reconciliation.
- `lib/backend/session-snapshot.ts`: independent resource loading and verified lifecycle status mapping.
- `lib/backend/latency.ts`: local timing instrumentation.
- `test/feed-labels.test.ts`, `test/file-tool-feed.test.ts`, `test/session-events.test.ts`, `test/session-startup.test.ts`, `test/agent-feed-render.test.tsx`, `test/submission-latency.test.tsx`: regressions.
- `docs/agent-feed-latency.md`: this evidence and validation report.

Backend:

- `src/runner/loop.ts`: immediate first text and claim-to-step timing.
- `src/diagnostics/timing.ts`: diagnostic stage definition.
- `scripts/latency-audit.ts`: current runner interface and 20 text samples.
- `test/runner-cancellation.test.ts`: first-chunk ordering, later batching and no-sandbox regression.
- `docs/agent-feed-latency-20261106.json`: measured offline before/after summary.
