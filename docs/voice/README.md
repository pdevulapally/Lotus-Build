# Voice interface review

Voice availability comes from the authenticated backend. No ElevenLabs key or provider SDK belongs in this frontend.

The computer page adds a compact voice surface beside the existing composer. The current session, message API, pending-command identities, approval controls, cancellation controls and SSE history remain authoritative. Native ElevenAgents Realtime handles conversation. Its two restricted tools execute on the backend; the browser never turns every utterance into a build request. Accepted clarifications use existing steering and durable HTTP command identities.

`VoiceControls` owns lifecycle and current task bindings. `VoicePanel` shows the animated blob and call status above the input while messages remain visible. Voice dialogue is rendered once in the normal chat feed: spoken user messages use user bubbles, and LotusBuild replies use the same assistant renderer as typed conversations. Caption notifications refresh server-saved history rather than duplicating prefixed text below the blob. `VoiceInputControls` places mute, stop-speech and end-call actions inside the existing input toolbar. Typing keeps Send available alongside audio actions. Ending voice restores focus to the input. Audio controls remain usable when task submission is disabled. `VoiceCall` handles bounded audio reconnection and generation fencing; `BrowserVoiceAudio` owns the user-gesture AudioContext, permission-gated capture, PCM playback and device cleanup. A bounded AudioWorklet resamples mono microphone input to 16kHz PCM. Playback uses the negotiated server-selected PCM rate. No recording file or local audio history is created.

The orb retains the owner's orange/sand/lilac ShaderGradient preset and soft glass form. Its motion follows actual listening/speaking state, not invented audio levels. The shader loads only for an open, visible, connected conversation. Reduced motion, muted listening, hidden pages, idle/connecting/error states and lost WebGL use a static graphic. Short screens use a smaller visible blob. End call stops audio; clicking or typing in chat keeps the call open. Escape from the voice controls ends the call. Accepted task work continues.

The signed-in workspace waveform checks availability, creates a project and an empty Plan session with `entrypoint=voice`, then navigates to its chat and connects voice. The session is idle with zero messages: there is no invented opening prompt, queued build or build charge. The click-unlocked AudioContext is transferred only to that account and session, with abandoned resources closed. In an existing project, the waveform connects the current session. There is no extra Start voice, checkbox or terms expander; the account Terms and Privacy Policy describe voice processing. Browser microphone permission remains required.

A private backend WebSocket sends a fresh Firebase token in its first frame, not in its URL. Browser voice connects to no ElevenLabs endpoint. During a provider outage, accepted work continues; reconnecting refreshes the same task. No audio or utterance is replayed.

The controls distinguish microphone mute, stop speech, end call and task cancellation. A pending approval cannot be answered by an automatically submitted voice transcript. Users review and approve/reject the existing exact action in chat. Final voice dialogue joins canonical project chat as explicit conversation notes. The backend fences duplicate/uncertain tool submissions with existing durable command receipts.

## Rendered review

These historical screenshots show the earlier popup design with simulated state. They do not represent the current inline layout or prove a live audio conversation:

- [Desktop shader card](desktop.png)
- [390px mobile shader card](mobile.png)
- [Dark theme](dark.png)

The earlier shader was verified locally in headless Chrome, including reduced motion and WebGL context loss. The current inline panel and composer control states have server-rendered component checks. Current browser visual review and authenticated live microphone verification remain outstanding because the browser access host is unavailable.

## Local validation

- `npm run typecheck`
- `node --env-file=.env.local --import tsx --test test/*.test.ts test/*.test.tsx` (uses existing required public configuration; no provider calls)
- `npm run build`

Voice contract tests are mocked: they test native captions without automatic task submission, private backend access, continuous chunk playback, interruption/stale audio, bounded reconnection, task status refresh, denied permissions, expiry, privacy failure, mute/end-call and approval boundaries on the backend. Existing tests cover authenticated cancellation and action-bound pending requests.

A separate local headless Chrome test used a synthetic WebAudio MediaStream at a 390px mobile viewport. It verified a real AudioWorklet emitted 6400-byte PCM chunks, muting disabled its track, end-call stopped the track, denied permission propagated, and failed backend authorization did not request microphone access. It made zero provider requests. This is desktop Chrome mobile emulation, not physical iOS Safari or Android microphone verification.

## Backend activation dependencies

See `docs/voice-agents.md` in `lotusbuild-server` for the protocol, strict deployment policy, existing entitlement/meter additions, conservative shared spending cap, proposed plan allowances and privacy coverage requirements. The backend must land before this UI can connect; with voice unconfigured, the UI explicitly offers continued text use. There is no standard-retention fallback.

Required before live rollout: owner approval of allowances/cost/privacy policy, verified ElevenLabs account and downstream-provider zero-retention coverage, a private pinned native Realtime Max agent, two restricted client tools, an audited configuration digest and verified provider spending controls, authenticated browser end-to-end evaluation after approval, and real-device tests of permission prompts/revocation, speaker echo, interruption, backgrounding and network changes. No activation or production deployment is authorized by this implementation.
