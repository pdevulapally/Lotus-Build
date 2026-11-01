import type { VoiceAudio } from './browser-audio'

/** Transfers only the click-unlocked audio resource across client navigation, never business state. */
let pending: { uid: string; sessionId: string; audio: VoiceAudio; timer: ReturnType<typeof setTimeout> } | null = null

export function handoffVoiceAudio(uid: string, sessionId: string, audio: VoiceAudio) {
  if (pending) { clearTimeout(pending.timer); pending.audio.close() }
  const timer = setTimeout(() => {
    if (pending?.audio === audio) { pending = null; audio.close() }
  }, 30_000)
  pending = { uid, sessionId, audio, timer }
}

export function takeVoiceAudio(uid: string, sessionId: string): VoiceAudio | undefined {
  if (!pending) return
  const resource = pending
  pending = null
  clearTimeout(resource.timer)
  if (resource.uid !== uid || resource.sessionId !== sessionId) { resource.audio.close(); return }
  return resource.audio
}
