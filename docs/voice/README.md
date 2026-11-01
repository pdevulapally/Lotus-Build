# Voice interface review

Local implementation; voice stays disabled until the backend operator approves and configures it. No ElevenLabs key or provider SDK belongs in this frontend.

The computer page adds a compact voice surface beside the existing composer. The current session, message API, pending-command identities, approval controls, cancellation controls and SSE history remain authoritative. Native ElevenAgents Realtime handles conversation. Its two restricted tools execute on the backend; the browser never turns every utterance into a build request. Accepted clarifications use existing steering and durable HTTP command identities.

`VoiceControls` owns lifecycle and current task bindings; `VoicePanel` renders an accessible nonmodal popover beside the chat composer; `VoiceCall` handles bounded audio reconnection and generation fencing; `BrowserVoiceAudio` owns the user-gesture AudioContext, permission-gated capture, PCM playback and device cleanup. A bounded AudioWorklet resamples mono microphone input to 16kHz PCM. Playback uses the negotiated server-selected PCM rate. No recording file or local audio history is created.

The orb uses the owner's orange/sand/lilac ShaderGradient preset, clipped into a soft glass form. Its motion follows actual listening/speaking state, not invented audio levels. The existing shader package loads only for an open, visible, connected conversation. Reduced motion, muted listening, hidden pages, idle/connecting/error states and lost WebGL use a static graphic; very short screens omit the decoration to keep status and controls visible. Closing the panel ends the audio call; clicking/typing in chat while a call is active keeps the panel open. Escape closes the call/panel and returns keyboard focus through the existing popover component. Accepted task work continues.

The frontend first checks the authenticated backend's voice availability and task access. A private WebSocket to that same backend sends a fresh Firebase token in its first frame, not in its URL. Browser voice connects to no ElevenLabs endpoint. Starting voice does not create a session. During a provider outage, accepted work continues; reconnecting refreshes the same task. No audio or utterance is replayed.

The controls distinguish microphone mute, stop speech, end call and task cancellation. A pending approval cannot be answered by an automatically submitted voice transcript. Users review and approve/reject the existing exact action in chat. Live captions are shown; final voice dialogue joins canonical project chat as explicit conversation notes. The backend fences duplicate/uncertain tool submissions with existing durable command receipts.

## Rendered review

These screenshots show the actual presentational component with simulated state, generated locally in headless Chrome. They are not proof of a connected account or live audio conversation:

- [Desktop shader card](desktop.png)
- [390px mobile shader card](mobile.png)
- [Dark theme](dark.png)

Verified in local headless Chrome: actual WebGL shader renders without page errors; popover remains within desktop, 390px mobile and 320×568 viewport bounds; microphone/end-call/stop controls remain accessible; consent gates start; chat typing does not disconnect voice; Escape restores focus; dark theme and reduced motion work. Forcing WebGL context loss removes the renderer while retaining the controls and static graphic. Model states in these screenshots are simulated, not a connected ElevenLabs call. The actual authenticated computer page has not been exercised with a verified test account.

## Local validation

- `npm run typecheck`
- `node --env-file=.env.local --import tsx --test test/*.test.ts test/*.test.tsx` (uses existing required public configuration; no provider calls)
- `npm run build`

Voice contract tests are mocked: they test native captions without automatic task submission, private backend access, continuous chunk playback, interruption/stale audio, bounded reconnection, task status refresh, denied permissions, expiry, privacy failure, mute/end-call and approval boundaries on the backend. Existing tests cover authenticated cancellation and action-bound pending requests.

A separate local headless Chrome test used a synthetic WebAudio MediaStream at a 390px mobile viewport. It verified a real AudioWorklet emitted 6400-byte PCM chunks, muting disabled its track, end-call stopped the track, denied permission propagated, and failed backend authorization did not request microphone access. It made zero provider requests. This is desktop Chrome mobile emulation, not physical iOS Safari or Android microphone verification.

## Backend activation dependencies

See `docs/voice-agents.md` in `lotusbuild-server` for the protocol, strict deployment policy, existing entitlement/meter additions, conservative shared spending cap, proposed plan allowances and privacy coverage requirements. The backend must land before this UI can connect; with voice unconfigured, the UI explicitly offers continued text use. There is no standard-retention fallback.

Required before live rollout: owner approval of allowances/cost/privacy policy, verified ElevenLabs account and downstream-provider zero-retention coverage, a private pinned native Realtime Max agent, two restricted client tools, an audited configuration digest and verified provider spending controls, authenticated browser end-to-end evaluation after approval, and real-device tests of permission prompts/revocation, speaker echo, interruption, backgrounding and network changes. No activation or production deployment is authorized by this implementation.
