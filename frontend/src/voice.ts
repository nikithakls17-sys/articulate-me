import { useCallback, useEffect, useRef, useState } from 'react'

/** null = unknown, false = the server has no voice in this mode (404), so use the browser's voice. */
let ttsAvailable: boolean | null = null
let current: HTMLAudioElement | null = null
let pendingEnd: (() => void) | null = null
// Every speak() gets a generation number. stopSpeaking() or a newer speak() bumps it, so audio that finishes
// generating after you pressed stop is thrown away instead of playing on top of the next line.
let generation = 0
const cache = new Map<string, string>() // `${voice}|${text}` -> object URL
const VOLUME_KEY = 'articulate.volume'

export function getVolume() {
  try { const v = Number(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null ? v : 1 } catch { return 1 }
}
export function setVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(v)) } catch { /* ignore */ }
  if (current) current.volume = v
}

/** iOS only lets audio play after a tap. Call this inside a tap handler before any async speech. */
export function unlockAudio() {
  try {
    const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=')
    a.play().catch(() => {})
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  } catch { /* ignore */ }
}

/** Fetch (or reuse) the server's audio for a line. null = use the browser's voice. Safe to call ahead of time. */
export async function fetchSpeech(text: string, voice = 'narrator'): Promise<string | null> {
  if (ttsAvailable === false) return null
  const key = `${voice}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }) })
    if (r.status === 404) { ttsAvailable = false; return null } // no voice in this mode: browser from now on
    if (!r.ok) return null // one failed line falls back for that line only
    ttsAvailable = true
    const url = URL.createObjectURL(await r.blob())
    cache.set(key, url)
    return url
  } catch {
    return null
  }
}

function browserSay(text: string, gen: number, done: () => void) {
  if (!('speechSynthesis' in window) || gen !== generation) return done()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1
  u.volume = getVolume()
  u.onend = done
  u.onerror = done
  window.speechSynthesis.speak(u)
}

/** Speak one line. Resolves when it ends, or immediately if it was stopped or superseded. */
export function speak(text: string, voice = 'narrator'): Promise<void> {
  stopSpeaking()
  const gen = generation
  return new Promise((resolve) => {
    pendingEnd = resolve
    const done = () => { if (pendingEnd === resolve) pendingEnd = null; resolve() }
    fetchSpeech(text, voice).then((url) => {
      if (gen !== generation) return done() // stopped while the audio was being made
      if (!url) return browserSay(text, gen, done)
      const a = new Audio(url)
      a.volume = getVolume()
      current = a
      a.onended = done
      a.onerror = done
      a.play().catch(() => browserSay(text, gen, done))
    })
  })
}

export function stopSpeaking() {
  generation++
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
