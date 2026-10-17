import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Highlighter, Loader2, Play, Square, Volume1, Volume2, VolumeX, X } from 'lucide-react'
import { api, type Lesson, type QuizResult } from '../api'
import { useSession } from '../session'
import PageView from '../components/PageView'
import Book, { useMedia } from '../components/Book'
import { getVolume, setVolume, stopSpeaking } from '../voice'
import { useReadAloud } from '../reading'
import { useStudy } from '../study'
import Blob, { BlobSays } from '../components/Blob'

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
  const [volume, setVol] = useState(getVolume)
  const bookRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const leavesRef = useRef(0)
  posRef.current = pos
  // read-aloud turns the page itself at the end of the visible page(s); stops at the end of the chapter
  const read = useReadAloud(bookRef, () => {
    if (posRef.current + 1 >= leavesRef.current) return false
    setPos(posRef.current + 1)
    return true
  })

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

  leavesRef.current = leaves
  // turning by hand stops reading and clears the cursor
  const turn = (n: number) => { read.stop(); read.setCursor(null); setPos(Math.max(0, Math.min(leaves, n))) }

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
      <div className="flex items-end justify-between">
        <p className="label text-muted">{pages.length} pages · quick check at the end</p>
        <Blob mood="calm" accessory="specs" size={64} />
      </div>
    </div>
  )
  const endPage = (
    <div className="flex h-full flex-col items-start justify-center gap-4 p-8">
      <Blob mood="proud" accessory="cap" size={80} />
      <p className="label text-check">End of chapter {day}</p>
      <h2 className="text-3xl font-bold">Nice reading, {user.name}.</h2>
      <p className="text-lg text-muted">Three questions to make sure {lesson.technique} clicked.</p>
      <button className="btn bg-check" onClick={() => setQuiz(true)}>Start the quick check <ArrowRight size={18} /></button>
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
          <div ref={bookRef} className="select-text"
            onClick={(e) => {
              // tap a sentence to put the reading cursor there (but not while selecting text for a note)
              const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]')
              if (!el || window.getSelection()?.toString()) return
              const reading = read.status !== 'idle'
              if (reading) read.stop()
              read.setCursor(el.dataset.sayId ?? null)
              if (reading) window.setTimeout(read.start, 60)
            }}>
            <Book faces={faces} coverLeft={coverLeft} end={endPage} spread={spread} position={pos} onPosition={turn} height={bookHeight} />
          </div>
          {!selection && !saved && (
            <div className="mx-auto flex w-full max-w-xl items-center gap-2">
              <button className="btn-ghost px-3" onClick={() => turn(pos - 1)} disabled={pos === 0} aria-label="Previous page"><ChevronLeft /></button>
              <p className="label flex-1 text-center text-muted">
                {atEnd ? 'End' : spread ? `pp. ${visible.map((n) => n + 1).join('–')} of ${pages.length}` : `p. ${current + 1} of ${pages.length}`}
              </p>
              {atEnd
                ? <button className="btn-primary px-4" onClick={() => setQuiz(true)}>Quick check</button>
                : <button className="btn-primary px-3" onClick={() => turn(pos + 1)} aria-label="Next page"><ChevronRight /></button>}
            </div>
          )}
          {!atEnd && (
            <div className="mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 border-2 border-ink bg-white p-2 shadow-[3px_3px_0_var(--ink)]">
              {read.status === 'idle' ? (
                <button className="btn bg-read px-3 py-2 text-white" onClick={read.start}>
                  <Play size={16} /> {read.cursor ? 'Read from cursor' : 'Start reading'}
                </button>
              ) : (
                <button className="btn bg-talk px-3 py-2 text-white" onClick={read.stop}>
                  {read.status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} fill="currentColor" />} Stop reading
                </button>
              )}
              <label className="flex min-w-[9rem] flex-1 items-center gap-2">
                <span className="sr-only">Volume</span>
                {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                <input type="range" min={0} max={1} step={0.05} value={volume} aria-label="Reading volume"
                  onChange={(e) => { const v = Number(e.target.value); setVol(v); setVolume(v) }}
                  className="h-2 flex-1 accent-[var(--read)]" />
              </label>
              <p className="label w-full text-muted">
                {read.status === 'idle' ? 'Tap any sentence to start reading from there' : read.status === 'loading' ? 'Getting the voice ready…' : 'Reading · tap another sentence to jump'}
              </p>
            </div>
          )}
          <p className="label flex items-center justify-center gap-1.5 text-muted">
            <Highlighter size={13} /> Select text to save it · {spread ? 'arrow keys or page corners' : 'swipe or tap the corner'} to turn
          </p>
        </>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="card border-l-[10px] border-l-check">
            <p className="label text-check">End of chapter {day} · quick check</p>
            <div className="mt-2"><BlobSays mood="thinking" size={56}>Three quick ones, {user.name}. No trick questions, promise.</BlobSays></div>
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
              <div className="card flex items-center gap-4">
                <Blob mood={result.correct === result.total ? 'excited' : result.correct > 0 ? 'happy' : 'nervous'}
                  accessory={result.correct === result.total ? 'cap' : 'none'} size={80} />
                <div>
                  <p className="font-heading text-4xl font-bold">{result.correct}/{result.total}</p>
                  <p className="text-lg">{result.correct === result.total ? `Perfect, ${user.name}!` : result.correct > 0 ? `Good work, ${user.name}. Check the ones I marked.` : `That's okay, ${user.name}. Have a look at the explanations.`}</p>
                  <p className="label mt-1 text-muted">+{result.xp} XP · chapter complete</p>
                </div>
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
