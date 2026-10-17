import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Attempt, type Lesson } from '../api'
import { useSession } from '../session'
import { speak, stopSpeaking, useRecorder } from '../voice'
import FeedbackView from '../components/FeedbackView'
import CitationChip from '../components/CitationChip'

type Stage = 'learn' | 'practice' | 'grading' | 'feedback'
const GRADING_LINES = ['Listening back…', 'Counting your “um”s…', 'Checking the technique…', 'Finding your best line…', 'Writing one fix…']
const MAX_SEC = 90

export default function DayFlow() {
  const day = Number(useParams().day)
  const { user, refresh } = useSession()
  const nav = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [stage, setStage] = useState<Stage>('learn')
  const [card, setCard] = useState(0)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [error, setError] = useState('')
  const [line, setLine] = useState(0)
  const [narrating, setNarrating] = useState(false)
  const rec = useRecorder(MAX_SEC)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    api.lesson(day, user.world).then((l) => {
      setLesson(l)
      if (!l.teach.length) setStage('practice')
    }).catch((e) => setError(e.message))
    return () => stopSpeaking()
  }, [day, user])

  useEffect(() => {
    if (stage !== 'grading') return
    const t = window.setInterval(() => setLine((n) => (n + 1) % GRADING_LINES.length), 2200)
    return () => window.clearInterval(t)
  }, [stage])

  if (error && !lesson) return <ErrorBox message={error} />
  if (!lesson || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  const cards: { title: string; body: string; example?: boolean }[] = [
    ...lesson.teach.map((t, i) => ({ title: i === 0 ? lesson.title : `Step ${i + 1}`, body: t })),
    { title: 'Why it works', body: lesson.why_it_works },
    { title: 'Hear it in your world', body: lesson.example, example: true },
  ]

  const goCard = (i: number) => {
    setCard(i)
    scroller.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const narrate = () => {
    if (narrating) { stopSpeaking(); setNarrating(false); return }
    setNarrating(true)
    speak(`${cards[card].title}. ${cards[card].body}`, () => setNarrating(false))
  }

  const record = async () => {
    if (rec.recording) { rec.stop(); return }
    stopSpeaking()
    setError('')
    const blob = await rec.start()
    if (!blob) return
    if (blob.size < 2000) { setError("That was too short for me to hear. Try again and speak for at least a few seconds."); return }
    setStage('grading')
    try {
      const a = await api.attempt(user.id, day, blob)
      setAttempt(a)
      setStage('feedback')
      refresh()
    } catch (e) {
      setError((e as Error).message)
      setStage('practice')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link to="/" className="text-3xl font-black text-muted" aria-label="Close">×</Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-leaf transition-all"
            style={{ width: `${stage === 'learn' ? ((card + 1) / (cards.length + 2)) * 100 : stage === 'feedback' ? 100 : 85}%` }} />
        </div>
        <span className="text-sm font-extrabold text-muted">Day {day}</span>
      </header>

      {stage === 'learn' && (
        <>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-coral">Learn · {lesson.technique}</p>
            <h1 className="text-3xl font-black">{lesson.title}</h1>
          </div>
          <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
            onScroll={(e) => {
              const el = e.currentTarget
              setCard(Math.round(el.scrollLeft / (el.firstElementChild as HTMLElement).offsetWidth))
            }}>
            {cards.map((c, i) => (
              <article key={i} className={`card min-h-64 w-[85%] shrink-0 snap-start ${c.example ? 'bg-leaf-soft border-leaf/30' : ''}`}>
                <h2 className="text-xl font-black">{c.title}</h2>
                <p className={`mt-3 text-lg leading-relaxed ${c.example ? 'italic' : ''}`}>{c.example ? `“${c.body}”` : c.body}</p>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            {cards.map((_, i) => (
              <button key={i} onClick={() => goCard(i)} aria-label={`Card ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${i === card ? 'w-6 bg-coral' : 'w-2.5 bg-line'}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="chip" onClick={narrate}>{narrating ? '⏹ Stop' : '🔊 Listen'}</button>
            {lesson.citations.map((c, i) => <CitationChip key={i} c={c} />)}
          </div>
          {card < cards.length - 1
            ? <button className="btn-primary" onClick={() => goCard(card + 1)}>Next</button>
            : <button className="btn-primary" onClick={() => setStage('practice')}>I'm ready to practice</button>}
        </>
      )}

      {stage === 'practice' && (
        <>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-coral">
              {day === 0 ? 'Day 0 · Baseline' : `Practice · ${lesson.technique}`}
            </p>
            <h1 className="mt-1 text-2xl font-black leading-snug">{lesson.drill.prompt}</h1>
          </div>
          {day > 0 && (
            <details className="card text-sm">
              <summary className="cursor-pointer font-extrabold">What I'll listen for</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {lesson.rubric.map((r) => <li key={r.id}>{r.check}</li>)}
              </ul>
            </details>
          )}
          <div className="flex flex-col items-center gap-4 py-6">
            <Countdown elapsed={rec.elapsed} limit={lesson.drill.time_limit_sec} active={rec.recording} />
            <button onClick={record} aria-label={rec.recording ? 'Stop recording' : 'Start recording'}
              className={`grid h-36 w-36 place-items-center rounded-full text-6xl text-white transition active:translate-y-1
                ${rec.recording ? 'bg-coral-dark shadow-[0_0_0_12px_rgba(242,84,45,0.25)] animate-pulse' : 'bg-coral shadow-[0_8px_0_var(--color-coral-dark)]'}`}>
              {rec.recording ? '■' : '🎙️'}
            </button>
            <p className="text-center font-bold text-muted">
              {rec.recording ? 'Listening… tap to finish' : `Tap and talk. Aim for about ${lesson.drill.time_limit_sec} seconds.`}
            </p>
          </div>
          {(rec.error || error) && <ErrorBox message={rec.error || error} />}
        </>
      )}

      {stage === 'grading' && (
        <div className="flex flex-col items-center gap-6 py-24 text-center">
          <div className="text-7xl animate-bounce" aria-hidden>👂</div>
          <p className="text-2xl font-black">{GRADING_LINES[line]}</p>
          <p className="text-muted">This takes a few seconds.</p>
        </div>
      )}

      {stage === 'feedback' && attempt && (
        <FeedbackView attempt={attempt} lesson={lesson}
          onRetry={() => { setAttempt(null); setStage('practice') }}
          onDone={() => nav('/')} />
      )}
    </div>
  )
}

function Countdown({ elapsed, limit, active }: { elapsed: number; limit: number; active: boolean }) {
  const left = Math.max(0, Math.ceil(limit - elapsed))
  const over = elapsed > limit
  return (
    <div className={`text-5xl font-black tabular-nums ${over ? 'text-coral' : active ? 'text-ink' : 'text-muted'}`}>
      {over ? `+${Math.floor(elapsed - limit)}s` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <div className="card border-coral/40 bg-orange-50 font-bold text-coral-dark">{message}</div>
}
