"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** The subset of the Web Speech API this hook relies on; Chrome, Edge and Safari ship it as `webkitSpeechRecognition`. */
type SpeechRecognitionLike = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: Event & { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
}

export const VOICE_LEVEL_COUNT = 28
const IDLE_LEVELS = Array.from({ length: VOICE_LEVEL_COUNT }, () => 0)

export const VOICE_ERRORS = {
  unsupported: "Voice input needs Chrome, Edge or Safari.",
  denied: "Microphone access was blocked. Allow it in your browser and try again.",
  noMic: "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
  failed: "Voice input stopped unexpectedly.",
} as const

export function voiceErrorMessage(code: string | undefined): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed": return VOICE_ERRORS.denied
    case "audio-capture": return VOICE_ERRORS.noMic
    case "network": return VOICE_ERRORS.network
    default: return VOICE_ERRORS.failed
  }
}

function recognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type VoiceDictation = {
  supported: boolean
  listening: boolean
  /** Final sentences so far, followed by the phrase still being recognised. */
  transcript: string
  /** Recent microphone loudness samples in 0..1, oldest first; drives the waveform. */
  levels: number[]
  error: string | null
  start: () => void
  /** Ends recording and hands the transcript to `onDone`. */
  finish: () => void
  /** Ends recording and discards the transcript. */
  cancel: () => void
}

/**
 * Browser speech recognition plus a live microphone meter. Recognition runs in the
 * browser engine (no server call from this app); the meter samples the mic through
 * Web Audio so the waveform moves with the user's voice, not with recognition events.
 */
export function useVoiceDictation(onDone: (text: string) => void): VoiceDictation {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef("")
  const outcomeRef = useRef<"finish" | "cancel" | null>(null)
  const meterRef = useRef<{ stop: () => void } | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => { setSupported(recognitionConstructor() !== null) }, [])

  const stopMeter = useCallback(() => { meterRef.current?.stop(); meterRef.current = null; setLevels(IDLE_LEVELS) }, [])

  const startMeter = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      let frame = 0
      const tick = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) { const centred = (sample - 128) / 128; sum += centred * centred }
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4)
        setLevels((current) => [...current.slice(1), level])
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      meterRef.current = {
        stop: () => {
          cancelAnimationFrame(frame)
          for (const track of stream.getTracks()) track.stop()
          void context.close().catch(() => undefined)
        },
      }
    } catch {
      // The meter is cosmetic; recognition reports a real microphone problem itself.
    }
  }, [])

  const teardown = useCallback(() => {
    stopMeter()
    recognitionRef.current = null
    setListening(false)
    setInterimText("")
  }, [stopMeter])

  const start = useCallback(() => {
    const Ctor = recognitionConstructor()
    if (!Ctor) { setSupported(false); setError(VOICE_ERRORS.unsupported); return }
    if (recognitionRef.current) return
    const recognition = new Ctor()
    recognitionRef.current = recognition
    finalRef.current = ""
    outcomeRef.current = null
    setFinalText(""); setInterimText(""); setError(null)
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"
    recognition.onresult = (event) => {
      let interim = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript ?? ""
        if (result?.isFinal) finalRef.current = `${finalRef.current} ${text}`.trim()
        else interim += text
      }
      setFinalText(finalRef.current)
      setInterimText(interim.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return
      setError(voiceErrorMessage(event.error))
      outcomeRef.current = "cancel"
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      const outcome = outcomeRef.current ?? "finish"
      const text = finalRef.current.trim()
      teardown()
      if (outcome === "finish" && text) onDoneRef.current(text)
    }
    try {
      recognition.start()
      setListening(true)
      void startMeter()
    } catch {
      recognitionRef.current = null
      setError(VOICE_ERRORS.failed)
    }
  }, [startMeter, teardown])

  const finish = useCallback(() => { outcomeRef.current = "finish"; recognitionRef.current?.stop() }, [])
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    outcomeRef.current = "cancel"
    if (recognition) { recognitionRef.current = null; recognition.abort() }
    teardown()
  }, [teardown])

  useEffect(() => () => { recognitionRef.current?.abort(); recognitionRef.current = null; meterRef.current?.stop() }, [])

  return {
    supported, listening, levels, error, start, finish, cancel,
    transcript: [finalText, interimText].filter(Boolean).join(" "),
  }
}
