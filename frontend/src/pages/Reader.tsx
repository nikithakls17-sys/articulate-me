import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Highlighter, Volume2, VolumeX, X } from 'lucide-react'
import { api, type Lesson, type Page, type QuizResult } from '../api'
import { useSession } from '../session'
import PageView from '../components/PageView'
import Book, { useMedia } from '../components/Book'
import { speak, stopSpeaking } from '../voice'
import { useStudy } from '../study'

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

const FIGURE_KINDS = new Set(['steps', 'table', 'before_after', 'example'])

export default function Reader() {
  const day = Number(useParams().day)
  const { user, refresh } = useSession()
  const study = useStudy()
  const userId = user?.id
  const nav = useNavigate()
  const spread = useMedia('(min-width: 1024px)')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState('')
  const [pos, setPos] = useState(0)
  const [quiz, setQuiz] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [result, setResult] = useState<QuizResult | null>(null)
  const [selection, setSelection] = useState('')
  const [saved, setSaved] = useState('')
  const [reading, setReading] = useState(false)
  const bookRef = useRef<HTMLDivElement>(null)

  // depend on the user id, not the user object: refresh() replaces the object and must not reload the lesson
  useEffect(() => {
    if (!userId) return
    api.lesson(day, userId).then((l) => { setLesson(l); setAnswers(l.quiz.map(() => null)) }).catch((e) => setError(e.message))
    return () => stopSpeaking()
  }, [day, userId])

  // keep the same page open when the layout switches between spread and single
  const prevSpread = useRef(spread)
  useEffect(() => {
    if (prevSpread.current !== spread) setPos((p) => (spread ? Math.floor(p / 2) : p * 2))
    prevSpread.current = spread
  }, [spread])

  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection()
      const text = s && !s.isCollapsed && bookRef.current?.contains(s.anchorNode) ? s.toString().trim() : ''
      setSelection(text.length >= 3 ? text : '')
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  if (error) return <div className="card mt-10 font-bold text-coral-dark">{error} <Link to="/" className="underline">Back</Link></div>
  if (!lesson || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  const pages = lesson.pages
  const leaves = spread ? Math.ceil(pages.length / 2) : pages.length
  const atEnd = pos >= leaves
  // the page the reader is looking at (right-hand page on a spread)
  const current = spread ? Math.min(2 * pos, pages.length - 1) : Math.min(pos, pages.length - 1)
  const visible = spread ? [2 * pos - 1, 2 * pos].filter((n) => n >= 0 && n < pages.length) : [current]

  let fig = 0
  const figureNos = pages.map((p) => (FIGURE_KINDS.has(p.kind) ? ++fig : 0))
  const faces = pages.map((p, i) => (
    <PageView key={i} page={p} chapter={day} chapterTitle={lesson.title} technique={lesson.technique}
      pageNo={i + 1} figureNo={figureNos[i]} />
  ))

  const turn = (n: number) => { stopSpeaking(); setReading(false); setPos(Math.max(0, Math.min(leaves, n))) }

  const saveNote = async () => {
    const text = selection
    const page = pages[current]
    window.getSelection()?.removeAllRanges()
    setSelection('')
    await api.addNote({ user_id: user.id, day, page_title: page.title, text, citation: 'cite' in page ? page.cite : lesson.citations[0] })
    study.notesChanged()
    setSaved('Saved to My Notes')
    window.setTimeout(() => setSaved(''), 1800)
  }

  const readAloud = async () => {
    if (reading) { stopSpeaking(); setReading(false); return }
    setReading(true)
    for (const n of visible) await speak(`${pages[n].title}. ${pageText(pages[n])}`, 'narrator')
    setReading(false)
  }

  const submit = async () => {
    const r = await api.quiz(day, user.id, answers.map((a) => a ?? -1))
    setResult(r)
    refresh()
    study.refreshTargets()
  }

  const nextStep = day === 1 && !user.days['0']?.practiced
    ? { to: '/talk/0', label: "Next: let's see where you're starting" }
    : { to: `/talk/${day}`, label: `Practice ${lesson.technique} in a conversation` }

  const coverLeft = (
    <div className="flex h-full flex-col justify-between p-8">
      <div>
        <p className="label text-coral">Chapter</p>
        <p className="font-heading text-[5.5rem] font-bold leading-none">{day}</p>
        <div className="rule mt-4 w-16" />
      </div>
      <div>
        <h1 className="text-3xl font-bold leading-tight">{lesson.title}</h1>
        <p className="mt-3 text-lg italic text-muted">{lesson.learn}</p>
      </div>
      <p className="label text-muted">{pages.length} pages · quick check at the end</p>
    </div>
  )
  const endPage = (
    <div className="flex h-full flex-col items-start justify-center gap-4 p-8">
      <p className="label text-coral">End of chapter {day}</p>
      <h2 className="text-3xl font-bold">Quick check</h2>
      <p className="text-lg text-muted">Three questions to make sure {lesson.technique} clicked.</p>
      <button className="btn-primary" onClick={() => setQuiz(true)}>Start the quick check <ArrowRight size={18} /></button>
    </div>
  )

  const bookHeight = spread ? 'min(76vh, 780px)' : 'calc(100dvh - 215px)'

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <Link to="/textbook" className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-white" aria-label="Close"><X size={22} /></Link>
        <div className="min-w-0 flex-1">
          <p className="label truncate text-coral">Chapter {day} · {lesson.technique}</p>
          <div className="mt-1 flex h-2 border-2 border-ink bg-white">
            <div className="bg-coral transition-all" style={{ width: `${quiz ? 100 : (Math.min(pos, leaves) / leaves) * 100}%` }} />
          </div>
        </div>
      </header>

      {!quiz ? (
        <>
          <div ref={bookRef} className="select-text">
            <Book faces={faces} coverLeft={coverLeft} end={endPage} spread={spread} position={pos} onPosition={turn} height={bookHeight} />
          </div>
          {!selection && !saved && (
            <div className="mx-auto flex w-full max-w-xl items-center gap-2">
              <button className="btn-ghost px-3" onClick={() => turn(pos - 1)} disabled={pos === 0} aria-label="Previous page"><ChevronLeft /></button>
              <button className="btn-ghost px-3" onClick={readAloud} disabled={atEnd} aria-label={reading ? 'Stop reading' : 'Read aloud'}>
                {reading ? <VolumeX /> : <Volume2 />}
              </button>
              <p className="label flex-1 text-center text-muted">
                {atEnd ? 'End' : spread ? `pp. ${visible.map((n) => n + 1).join('–')} of ${pages.length}` : `p. ${current + 1} of ${pages.length}`}
              </p>
              {atEnd
                ? <button className="btn-primary px-4" onClick={() => setQuiz(true)}>Quick check</button>
                : <button className="btn-primary px-3" onClick={() => turn(pos + 1)} aria-label="Next page"><ChevronRight /></button>}
            </div>
          )}
          <p className="label flex items-center justify-center gap-1.5 text-muted">
            <Highlighter size={13} /> Select text to save it · {spread ? 'arrow keys or page corners' : 'swipe or tap the corner'} to turn
          </p>
        </>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="card">
            <p className="label text-coral">End of chapter {day}</p>
            <h1 className="mt-1 text-3xl font-bold">Quick check</h1>
          </div>
          {lesson.quiz.map((q, qi) => (
            <fieldset key={qi} className="card flex flex-col gap-2">
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="font-heading text-lg font-bold">{qi + 1}. {q.q}</p>
              {q.options.map((o, oi) => {
                const r = result?.results[qi]
                const picked = answers[qi] === oi
                const state = !r ? (picked ? 'bg-sun' : 'bg-white')
                  : oi === r.answer ? 'bg-leaf-soft' : picked ? 'bg-orange-50 opacity-70' : 'bg-white opacity-60'
                return (
                  <button key={oi} disabled={!!result} onClick={() => setAnswers(answers.map((a, k) => (k === qi ? oi : a)))}
                    className={`flex items-center gap-2 border-2 border-ink p-3 text-left ${state} ${picked && !r ? 'shadow-[4px_4px_0_var(--ink)]' : ''}`}>
                    <span className="label w-5 shrink-0">{String.fromCharCode(65 + oi)}</span>
                    {r && oi === r.answer && <Check size={18} className="shrink-0 text-leaf" strokeWidth={3} />}
                    {o}
                  </button>
                )
              })}
              {result && <p className="italic text-muted">{result.results[qi].explain}</p>}
            </fieldset>
          ))}
          {!result ? (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button className="btn-ghost px-4" onClick={() => setQuiz(false)} aria-label="Back to the chapter"><ChevronLeft /></button>
              <button className="btn-primary" disabled={answers.some((a) => a === null)} onClick={submit}>Check my answers</button>
            </div>
          ) : (
            <>
              <div className="card text-center">
                <p className="font-heading text-5xl font-bold">{result.correct}/{result.total}</p>
                <p className="label mt-1 text-muted">+{result.xp} XP · chapter complete</p>
              </div>
              <button className="btn-primary" onClick={() => nav(nextStep.to)}>{nextStep.label}</button>
              <button className="btn-ghost" onClick={() => nav('/')}>Back to course</button>
            </>
          )}
        </div>
      )}

      {(selection || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {saved
            ? <div className="btn w-full bg-leaf text-white"><Check /> {saved}</div>
            : <button className="btn-primary w-full" onMouseDown={(e) => e.preventDefault()} onClick={saveNote}><Highlighter /> Save highlight to notes</button>}
        </div>
      )}
    </div>
  )
}
