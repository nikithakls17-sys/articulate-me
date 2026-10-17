import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Mic, Square, Volume2, X } from 'lucide-react'
import { api, WORLD_LABELS, type Attempt, type Conversation, type Lesson, type Turn } from '../api'
import { useSession } from '../session'
import { speak, stopSpeaking, unlockAudio, useRecorder } from '../voice'
import FeedbackView from '../components/FeedbackView'
import { WORLD_ICONS } from '../icons'
import Blob, { BlobSays } from '../components/Blob'

type Stage = 'intro' | 'partner' | 'your-turn' | 'sending' | 'grading' | 'feedback'
const GRADING_LINES = ['Reading the transcript…', 'Counting filler words…', 'Checking the technique…', 'Finding your best line…', 'Writing one fix…']
const MAX_SEC = 90

export default function Talk() {
  const day = Number(useParams().day)
  const { user, refresh } = useSession()
  const userId = user?.id
  const nav = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [world, setWorld] = useState<string | undefined>()
  const [convo, setConvo] = useState<Conversation | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [stage, setStage] = useState<Stage>('intro')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [error, setError] = useState('')
  const [line, setLine] = useState(0)
  const rec = useRecorder(MAX_SEC)
  const bottom = useRef<HTMLDivElement>(null)

  // keyed on the user id, not the user object: refresh() after grading must not reset this screen
  useEffect(() => {
    if (!userId) return
    api.lesson(day, userId, world).then(setLesson).catch((e) => setError(e.message))
    return () => stopSpeaking()
  }, [day, userId, world])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns, stage])

  useEffect(() => {
    if (stage !== 'grading') return
    const t = window.setInterval(() => setLine((n) => (n + 1) % GRADING_LINES.length), 2200)
    return () => window.clearInterval(t)
  }, [stage])

  if (error && !lesson) return <div className="card mt-10 font-bold text-coral-dark">{error} <Link to="/" className="underline">Back</Link></div>
  if (!lesson || !user || !lesson.scenario) return <div className="py-20 text-center text-muted">Loading…</div>
  const sc = convo?.scenario ?? lesson.scenario
  const userTurns = turns.filter((t) => t.speaker === 'user').length
  const maxTurns = convo?.max_user_turns ?? (day === 0 ? 2 : 3)

  const partnerSays = async (text: string, voice = convo?.voice.key) => {
    setStage('partner')
    await speak(text, voice)
    setStage('your-turn')
  }

  const start = async () => {
    unlockAudio()
    setError('')
    try {
      const c = await api.startConversation(user.id, day, lesson.world)
      setConvo(c)
      setTurns(c.turns)
      await partnerSays(c.turns[0].text, c.voice.key)
    } catch (e) { setError((e as Error).message) }
  }

  const finish = async (c: Conversation) => {
    setStage('grading')
    try {
      const a = await api.finishConversation(c.id)
      setAttempt(a)
      setStage('feedback')
      refresh()
    } catch (e) {
      setError((e as Error).message)
      setStage('your-turn')
    }
  }

  const talk = async () => {
    if (!convo) return
    if (rec.recording) { rec.stop(); return }
    stopSpeaking()
    setError('')
    const blob = await rec.start()
    if (!blob) return
    if (blob.size < 1500) { setError('That was too short for me to hear. Tap the mic and try again.'); return }
    setStage('sending')
    try {
      const r = await api.sendTurn(convo.id, blob)
      setTurns((t) => [...t, { speaker: 'user', text: r.user_text }, { speaker: 'partner', text: r.partner_text }])
      if (r.done) {
        setStage('partner')
        await speak(r.partner_text, convo.voice.key)
        await finish(convo)
      } else {
        await partnerSays(r.partner_text)
      }
    } catch (e) {
      setError((e as Error).message)
      setStage('your-turn')
    }
  }

  const retry = () => {
    stopSpeaking()
    setConvo(null)
    setTurns([])
    setAttempt(null)
    setStage('intro')
  }

  const WorldIcon = WORLD_ICONS[lesson.world]

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-xl text-muted" aria-label="Close"><X size={26} /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold uppercase tracking-wide text-coral">
            {day === 0 ? "Baseline · where you're starting" : `Practice · ${lesson.technique}`}
          </p>
          {stage !== 'intro' && stage !== 'feedback' && (
            <div className="mt-1 flex gap-1" aria-label={`Reply ${Math.min(userTurns + 1, maxTurns)} of ${maxTurns}`}>
              {Array.from({ length: maxTurns }, (_, n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n < userTurns ? 'bg-leaf' : 'bg-line'}`} />)}
            </div>
          )}
        </div>
      </header>

      {stage === 'intro' && (
        <>
          <div className="card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sky text-xl font-black text-white">
                {sc.partner.replace(/^(Dr|Mr|Mrs|Ms|Professor)\.?\s+/i, '').charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-xl font-black leading-tight">{sc.partner}</p>
                <p className="text-sm text-muted">{sc.role}</p>
              </div>
            </div>
            <p className="text-lg">{sc.setup}</p>
          </div>
          <BlobSays mood={day === 0 ? 'listening' : 'excited'} accessory={day === 0 ? 'headphones' : 'none'} size={60}>
            {day === 0
              ? <>No pressure, {user.name}. Just talk the way you normally would. I'll be listening.</>
              : <>You've got this, {user.name}. Try <b>{lesson.technique}</b> on {sc.partner.split(' ')[0]}. I'll listen and tell you what I heard.</>}
          </BlobSays>
          {day > 0 ? (
            <div className="card">
              <p className="text-xs font-extrabold uppercase tracking-wide text-coral">Your goal</p>
              <p className="mt-1 font-bold">Use {lesson.technique} when you answer. I'll listen for:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {lesson.rubric.map((r) => <li key={r.id}>{r.check}</li>)}
              </ul>
            </div>
          ) : (
            <div className="card bg-leaf-soft border-leaf/30">
              <p className="font-bold">No technique needed. Just talk the way you normally would, so we can measure where you're starting.</p>
            </div>
          )}
          {lesson.worlds.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a scenario">
              {lesson.worlds.map((w) => {
                const I = WORLD_ICONS[w]
                return (
                  <button key={w} onClick={() => setWorld(w)} aria-pressed={w === lesson.world}
                    className={`chip ${w === lesson.world ? 'border-coral text-coral' : ''}`}>
                    <I size={14} /> {WORLD_LABELS[w].label}
                  </button>
                )
              })}
            </div>
          )}
          <p className="flex items-center gap-2 text-sm text-muted">
            <WorldIcon size={16} /> {maxTurns} short replies. {sc.partner.split(' ')[0]} speaks first; tap the mic to answer.
          </p>
          {error && <p className="card border-coral/40 bg-orange-50 font-bold text-coral-dark">{error}</p>}
          <button className="btn-primary" onClick={start}><Volume2 /> Start the conversation</button>
        </>
      )}

      {stage !== 'intro' && stage !== 'feedback' && (
        <>
          <ol className="flex flex-col gap-3" aria-live="polite">
            {turns.map((t, n) => (
              <li key={n} className={`flex ${t.speaker === 'user' ? 'justify-end' : ''}`}>
                <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-[17px] leading-snug ${t.speaker === 'user'
                  ? 'rounded-br-md bg-coral text-white' : 'rounded-bl-md border-2 border-line bg-white'}`}>
                  {t.speaker === 'partner' && <p className="label text-read">{sc.partner}{convo?.voice && ` · ${convo.voice.label}`}</p>}
                  {t.text}
                </div>
              </li>
            ))}
            {stage === 'sending' && (
              <li className="flex justify-end"><div className="rounded-3xl rounded-br-md bg-coral/60 px-4 py-3 text-white">Listening back…</div></li>
            )}
          </ol>
          <div ref={bottom} />

          {stage === 'grading' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Blob mood="thinking" accessory="specs" size={96} />
              <p className="text-xl font-black">{GRADING_LINES[line]}</p>
              <p className="text-sm text-muted">This can take up to a minute on a laptop.</p>
            </div>
          ) : (
            <div className="sticky bottom-0 -mx-4 flex flex-col items-center gap-2 bg-cream/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              {(rec.error || error) && <p className="w-full rounded-2xl bg-orange-50 p-3 text-center font-bold text-coral-dark">{rec.error || error}</p>}
              <button onClick={talk} disabled={stage !== 'your-turn' && !rec.recording}
                aria-label={rec.recording ? 'Stop and send' : 'Tap to answer'}
                className={`grid h-24 w-24 place-items-center rounded-full text-white transition active:translate-y-1 disabled:opacity-40
                  ${rec.recording ? 'bg-coral-dark shadow-[0_0_0_10px_rgba(242,84,45,0.25)] animate-pulse' : 'bg-coral shadow-[0_6px_0_var(--color-coral-dark)]'}`}>
                {rec.recording ? <Square size={34} fill="currentColor" /> : <Mic size={40} />}
              </button>
              <p className="text-center text-sm font-bold text-muted">
                {rec.recording ? `Listening… ${Math.floor(rec.elapsed)}s · tap to send`
                  : stage === 'partner' ? `${sc.partner.split(' ')[0]} is talking…`
                  : stage === 'sending' ? 'Thinking…'
                  : `Your turn · reply ${userTurns + 1} of ${maxTurns}`}
              </p>
              {stage === 'partner' && <button className="text-xs font-bold text-sky underline" onClick={() => { stopSpeaking() }}>Skip voice</button>}
            </div>
          )}
        </>
      )}

      {stage === 'feedback' && attempt && (
        <FeedbackView attempt={attempt} technique={day === 0 ? null : lesson.technique} onRetry={retry} onDone={() => nav('/')} />
      )}
    </div>
  )
}
