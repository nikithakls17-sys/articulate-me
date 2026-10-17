import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Highlighter, Volume2, VolumeX, X } from 'lucide-react'
import { api, type Lesson, type Page, type QuizResult } from '../api'
import { useSession } from '../session'
import PageView from '../components/PageView'
import { speak, stopSpeaking } from '../voice'

function pageText(p: Page): string {
  switch (p.kind) {
    case 'steps': return p.steps.map((s) => `${s.label}. ${s.text}`).join(' ')
    case 'terms': return p.terms.map((t) => `${t.term}: ${t.meaning}`).join(' ')
    case 'table': return p.rows.map((r) => r.join(', ')).join('. ')
    case 'before_after': return `Before: ${p.before}. After: ${p.after}. ${p.why}`
    case 'intro': return `${p.body} ${p.learn}`
    default: return p.body
  }
}

export default function Reader() {
  const day = Number(useParams().day)
  const { user, refresh } = useSession()
  const userId = user?.id
  const nav = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState('')
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [result, setResult] = useState<QuizResult | null>(null)
  const [selection, setSelection] = useState('')
  const [saved, setSaved] = useState('')
  const [reading, setReading] = useState(false)
  const touchX = useRef<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // depend on the user id, not the user object: refresh() replaces the object and must not reload the lesson
  useEffect(() => {
    if (!userId) return
    api.lesson(day, userId).then((l) => { setLesson(l); setAnswers(l.quiz.map(() => null)) }).catch((e) => setError(e.message))
    return () => stopSpeaking()
  }, [day, userId])

  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection()
      const text = s && !s.isCollapsed && pageRef.current?.contains(s.anchorNode) ? s.toString().trim() : ''
      setSelection(text.length >= 3 ? text : '')
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  if (error) return <div className="card mt-10 font-bold text-coral-dark">{error} <Link to="/" className="underline">Back</Link></div>
  if (!lesson || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  const total = lesson.pages.length
  const onQuiz = i >= total
  const page = lesson.pages[Math.min(i, total - 1)]
  const go = (n: number) => { stopSpeaking(); setReading(false); setI(Math.max(0, Math.min(total, n))); window.scrollTo({ top: 0 }) }

  const saveNote = async () => {
    const text = selection
    window.getSelection()?.removeAllRanges()
    setSelection('')
    await api.addNote({ user_id: user.id, day, page_title: page.title, text, citation: 'cite' in page ? page.cite : lesson.citations[0] })
    setSaved('Saved to My Notes')
    window.setTimeout(() => setSaved(''), 1800)
  }

  const readAloud = async () => {
    if (reading) { stopSpeaking(); setReading(false); return }
    setReading(true)
    await speak(`${page.title}. ${pageText(page)}`)
    setReading(false)
  }

  const submit = async () => {
    const r = await api.quiz(day, user.id, answers.map((a) => a ?? -1))
    setResult(r)
    refresh()
  }

  const nextStep = day === 1 && !user.days['0']?.practiced
    ? { to: '/talk/0', label: "Next: let's see where you're starting" }
    : { to: `/talk/${day}`, label: `Practice ${lesson.technique} in a conversation` }

  return (
    <div className="flex flex-col gap-4"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null || selection) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 70 && !onQuiz) go(i + (dx < 0 ? 1 : -1))
      }}>
      <header className="flex items-center gap-3">
        <Link to="/textbook" className="grid h-10 w-10 place-items-center rounded-xl text-muted" aria-label="Close"><X size={26} /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold uppercase tracking-wide text-coral">Chapter {day} · {lesson.technique}</p>
          <div className="mt-1 flex gap-1">
            {[...lesson.pages, null].map((_, n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-coral' : 'bg-line'}`} />
            ))}
          </div>
        </div>
      </header>

      {!onQuiz ? (
        <>
          <div ref={pageRef} className="card min-h-[52dvh] select-text bg-white shadow-[0_6px_0_var(--color-line)]">
            <PageView page={page} technique={lesson.technique} />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <Highlighter size={14} /> Select any text to save it to your notes
          </p>
          {!selection && !saved && (
            <div className="sticky bottom-0 z-10 -mx-4 bg-cream/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
              <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2">
                <button className="btn-ghost px-4" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous page"><ChevronLeft /></button>
                <button className="btn-ghost px-4" onClick={readAloud} aria-label={reading ? 'Stop reading' : 'Read this page aloud'}>
                  {reading ? <VolumeX /> : <Volume2 />}
                </button>
                <button className="btn-primary" onClick={() => go(i + 1)}>
                  {i === total - 1 ? 'Quick check' : 'Next page'} <ChevronRight />
                </button>
              </div>
              <p className="mt-1 text-center text-xs font-bold text-muted">Page {i + 1} of {total}</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-black">Quick check</h1>
          {lesson.quiz.map((q, qi) => (
            <fieldset key={qi} className="card flex flex-col gap-2">
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="font-extrabold">{qi + 1}. {q.q}</p>
              {q.options.map((o, oi) => {
                const r = result?.results[qi]
                const picked = answers[qi] === oi
                const state = !r ? (picked ? 'border-coral bg-orange-50' : 'border-line bg-white')
                  : oi === r.answer ? 'border-leaf bg-leaf-soft' : picked ? 'border-coral bg-orange-50 opacity-70' : 'border-line bg-white opacity-60'
                return (
                  <button key={oi} disabled={!!result} onClick={() => setAnswers(answers.map((a, k) => (k === qi ? oi : a)))}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left font-bold ${state}`}>
                    {r && oi === r.answer && <Check size={18} className="shrink-0 text-leaf" />}
                    {o}
                  </button>
                )
              })}
              {result && <p className="text-sm text-muted">{result.results[qi].explain}</p>}
            </fieldset>
          ))}
          {!result ? (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button className="btn-ghost px-4" onClick={() => go(total - 1)} aria-label="Back to the chapter"><ChevronLeft /></button>
              <button className="btn-primary" disabled={answers.some((a) => a === null)} onClick={submit}>Check my answers</button>
            </div>
          ) : (
            <>
              <div className="card text-center">
                <p className="text-4xl font-black">{result.correct}/{result.total}</p>
                <p className="font-bold text-muted">+{result.xp} XP · chapter complete</p>
              </div>
              <button className="btn-primary" onClick={() => nav(nextStep.to)}>{nextStep.label}</button>
              <button className="btn-ghost" onClick={() => nav('/')}>Back to course</button>
            </>
          )}
        </div>
      )}

      {(selection || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {saved
            ? <div className="btn w-full bg-leaf text-white"><Check /> {saved}</div>
            : <button className="btn-primary w-full" onMouseDown={(e) => e.preventDefault()} onClick={saveNote}><Highlighter /> Save highlight to notes</button>}
        </div>
      )}
    </div>
  )
}
