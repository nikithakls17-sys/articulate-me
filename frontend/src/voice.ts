import { useCallback, useEffect, useRef, useState } from 'react'

let ttsAvailable: boolean | null = null
let current: HTMLAudioElement | null = null

/** ElevenLabs via the backend when hosted; the browser's own voice otherwise (local mode never leaves the machine). */
export async function speak(text: string, onEnd?: () => void) {
  stopSpeaking()
  if (ttsAvailable !== false) {
    try {
      const r = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      })
      if (r.ok) {
        ttsAvailable = true
        const url = URL.createObjectURL(await r.blob())
        current = new Audio(url)
        current.onended = () => { URL.revokeObjectURL(url); onEnd?.() }
        await current.play()
        return
      }
      ttsAvailable = false
    } catch {
      ttsAvailable = false
    }
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.98
    u.onend = () => onEnd?.()
    window.speechSynthesis.speak(u)
  } else {
    onEnd?.()
  }
}

export function stopSpeaking() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

export function useRecorder(maxSec: number) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const timer = useRef<number | null>(null)
  const resolver = useRef<((b: Blob | null) => void) | null>(null)

  const cleanup = () => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    rec.current?.stream.getTracks().forEach((t) => t.stop())
  }

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
  }, [])

  /** Resolves with the recording when stopped (by the user or the time cap). */
  const start = useCallback(async (): Promise<Blob | null> => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setError('I need your microphone to listen. Allow mic access and try again.')
      return null
    }
    const mime = pickMime()
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const parts: Blob[] = []
    r.ondataavailable = (e) => e.data.size && parts.push(e.data)
    const done = new Promise<Blob | null>((res) => { resolver.current = res })
    r.onstop = () => {
      cleanup()
      setRecording(false)
      resolver.current?.(parts.length ? new Blob(parts, { type: r.mimeType || mime || 'audio/webm' }) : null)
    }
    rec.current = r
    r.start(250)
    setRecording(true)
    setElapsed(0)
    const t0 = Date.now()
    timer.current = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000
      setElapsed(s)
      if (s >= maxSec) stop()
    }, 200)
    return done
  }, [maxSec, stop])

  useEffect(() => () => { cleanup(); stopSpeaking() }, [])

  return { recording, elapsed, error, start, stop }
}
