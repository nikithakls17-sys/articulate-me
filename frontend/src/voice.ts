import { useCallback, useEffect, useRef, useState } from 'react'

let ttsAvailable: boolean | null = null
let current: HTMLAudioElement | null = null
let pendingEnd: (() => void) | null = null

/** iOS only lets audio play after a tap. Call this inside a tap handler before any async speech. */
export function unlockAudio() {
  try {
    const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=')
    a.play().catch(() => {})
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  } catch { /* ignore */ }
}

/** ElevenLabs via the backend in hosted mode; the browser's own voice otherwise (local mode never leaves the machine).
 *  Resolves when speech ends (or right away if nothing can speak). */
export function speak(text: string, voice = 'narrator'): Promise<void> {
  stopSpeaking()
  return new Promise((resolve) => {
    pendingEnd = resolve
    const done = () => { if (pendingEnd === resolve) pendingEnd = null; resolve() }
    const browserVoice = () => {
      if (!('speechSynthesis' in window)) return done()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1
      u.onend = done
      u.onerror = done
      window.speechSynthesis.speak(u)
    }
    if (ttsAvailable === false) return browserVoice()
    fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }) })
      .then(async (r) => {
        if (!r.ok) { ttsAvailable = false; return browserVoice() }
        ttsAvailable = true
        const url = URL.createObjectURL(await r.blob())
        current = new Audio(url)
        current.onended = () => { URL.revokeObjectURL(url); done() }
        current.onerror = done
        await current.play().catch(browserVoice)
      })
      .catch(() => { ttsAvailable = false; browserVoice() })
  })
}

export function stopSpeaking() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  const end = pendingEnd
  pendingEnd = null
  end?.()
}

/** Pick what this browser can record: Chrome/Android/Firefox give webm/opus, iPhone Safari gives mp4/aac. */
function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac']
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
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
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Try Chrome, or Safari on iOS 14.3+.")
      return null
    }
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
    r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data) }
    const done = new Promise<Blob | null>((res) => { resolver.current = res })
    r.onstop = () => {
      cleanup()
      setRecording(false)
      const type = r.mimeType || mime || parts[0]?.type || 'audio/webm'
      resolver.current?.(parts.length ? new Blob(parts, { type }) : null)
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
