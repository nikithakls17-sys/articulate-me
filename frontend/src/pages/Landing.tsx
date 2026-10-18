import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, BookOpen, MessageCircle, Sparkles } from 'lucide-react'
import { api } from '../api'
import { Logo } from '../icons'
import { useSession } from '../session'
import ThemeToggle from '../components/ThemeToggle'
import Blob from '../components/Blob'

// STAND-IN COPY: the draft copy didn't come through; replace with Niki's text, keeping this shape.
const COPY = {
  kicker: 'A daily speaking course',
  headline: 'Say what you mean. The first time.',
  sub: 'Ten minutes a day. Read one technique from a real public speaking textbook, use it in a spoken conversation, and see exactly what landed, in your own words.',
  haveYouEver: [
    'known the answer, then heard yourself ramble right past it?',
    'said "um" so many times you lost your own point?',
    'frozen when someone said "so, tell me about yourself"?',
    'thought of the perfect reply an hour too late?',
    "watched someone's attention drift halfway through your story?",
    'been told "just be more confident" with no idea how?',
  ],
  why: {
    heading: 'Nobody teaches this. Everyone is judged on it.',
    caption: 'The gap, in three numbers.',
    // NACE: Niki's draft had 98.7% / 55.4% (Job Outlook 2026); not findable in public NACE pages (the report is
    // members-only), so this uses the published Job Outlook 2025 figures until the 2026 source is confirmed.
    rows: [
      { label: 'Employers who say communication skills matter in new graduates', value: '96.1%', bar: 96.1, note: 1 },
      { label: 'Employers who rate new graduates as proficient communicators', value: '53.5%', bar: 53.5, note: 1 },
      { label: 'International students who find it hard to make close friends with local students', value: '41%', bar: 41, note: 2 },
      { label: 'A private speaking coach', value: '$100–300', unit: 'per hour', note: 3 },
      { label: 'Articulate Me', value: '$5', unit: 'per month', highlight: true },
    ],
    sources: [
      { n: 1, text: 'NACE, Job Outlook 2025, via "The Gap in Perceptions of New Grads\' Competency Proficiency" (Jan 2025).',
        url: 'https://naceweb.org/career-readiness/competencies/the-gap-in-perceptions-of-new-grads-competency-proficiency-and-resources-to-shrink-it' },
      { n: 2, text: 'World Education Services, "Are U.S. HEIs Meeting the Needs of International Students?" (2019), p. 10.',
        url: 'https://knowledge.wes.org/rs/317-CTM-316/images/research-report-are-us-hei-meeting-the-needs-of-international-students.pdf' },
      { n: 3, text: 'Typical U.S. rate quoted by VocalImage, a speaking-app company.',
        url: 'https://www.vocalimage.app/en/public-speaking/coach/' },
    ],
  },
  quote: "Speaking well isn't a personality. It's a skill.",
  quoteAfter: 'And skills can be learned, one technique at a time.',
  steps: [
    { icon: BookOpen, title: 'Read', text: 'A short illustrated chapter on one technique, from open college textbooks.', tone: 'bg-read-soft!' },
    { icon: MessageCircle, title: 'Talk', text: 'Use it out loud with a conversation partner: an interviewer, a professor, a customer.', tone: 'bg-talk-soft!' },
    { icon: Sparkles, title: 'Grow', text: 'Feedback that quotes your own words back, one fix to try, and your before-and-after numbers.', tone: 'bg-leaf-soft!' },
  ],
  cta: 'Start Chapter 1, free',
  returning: "I've been here before",
}

/** Fades children in as they scroll into view; instant when reduced motion is on or the observer is missing. */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } },
      { rootMargin: '0px 0px -10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function Cta() {
  const nav = useNavigate()
  return (
    <button className="btn-primary w-full whitespace-nowrap px-4 py-4 text-[0.95rem] sm:w-auto sm:px-7 sm:text-base" onClick={() => nav('/welcome')}>
      {COPY.cta} <ArrowRight size={20} aria-hidden />
    </button>
  )
}

/** "I've been here before": a new device or cleared browser. Paste the resume code from Progress. */
function Returning() {
  const { signIn } = useSession()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const resume = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = code.trim().toLowerCase()
    if (!/^[0-9a-f]{32}$/.test(id)) { setError('A resume code is 32 letters and numbers. Find yours under Progress.'); return }
    setBusy(true); setError('')
    try {
      await api.user(id)
      signIn(id)
      nav('/')
    } catch {
      setError("That code didn't match anyone. Check it under Progress on your other device.")
      setBusy(false)
    }
  }

  if (!open) {
    return <button className="label text-muted underline" onClick={() => setOpen(true)}>{COPY.returning}</button>
  }
  return (
    <form onSubmit={resume} className="flex w-full max-w-md flex-col gap-2 border-2 border-ink bg-white p-3">
      <label className="font-bold">
        Your resume code
        <span className="block text-sm font-normal text-muted">On the device you used before: Progress, then "Resume code".</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} autoFocus
          className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-sm outline-none focus:bg-white" />
      </label>
      {error && <p className="label text-coral-dark" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1 py-2.5" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
        <button type="button" className="label px-2 underline" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
      </div>
    </form>
  )
}

/** The first screen for new visitors: the opening page of the book. */
export default function Landing() {
  return (
    <div className="landing min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 lg:px-8">
        <span className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-heading text-lg font-bold">Articulate Me</span>
        </span>
        <ThemeToggle />
      </header>

      {/* title page */}
      <section className="mx-auto max-w-[1200px] px-4 lg:px-8">
        <div className="running-head flex justify-between pb-1">
          <span>{COPY.kicker}</span><span>Chapter 1</span>
        </div>
        <div className="grid items-end gap-8 pb-10 pt-8 lg:grid-cols-[1fr_auto] lg:pb-16 lg:pt-14">
          <div className="flex flex-col gap-6">
            <h1 className="landing-headline font-bold">{COPY.headline}</h1>
            <p className="max-w-2xl text-lg leading-relaxed sm:text-xl">{COPY.sub}</p>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Cta />
              <Returning />
            </div>
          </div>
          <div className="hidden flex-col items-center gap-2 lg:flex" aria-hidden>
            <Blob who="sunny" size={150} />
            <p className="label text-muted">Sunny, your first teacher</p>
          </div>
        </div>
        <p className="label flex items-center gap-1.5 border-t-2 border-ink pt-2 text-muted"><ArrowDown size={14} aria-hidden /> Sound familiar?</p>
      </section>

      {/* have you ever... */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 lg:px-8 lg:py-16" aria-labelledby="hye">
        <h2 id="hye" className="mb-6 text-4xl font-bold sm:text-5xl">Have you ever…</h2>
        <ul className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          {COPY.haveYouEver.map((line, i) => (
            <li key={line}>
              <Reveal delay={(i % 2) * 120}>
                <div className="card flex h-full gap-4 p-5 lg:p-6">
                  <span className="label shrink-0 pt-1 text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <p className="font-heading text-xl leading-snug sm:text-2xl"><span className="text-muted">…</span>{line}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* why this exists: a textbook figure with footnoted sources */}
      <section className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-10" aria-labelledby="why">
        <h2 id="why" className="mb-5 text-3xl font-bold sm:text-4xl lg:text-5xl">{COPY.why.heading}</h2>
        <Reveal>
          <figure className="mx-auto max-w-3xl border-2 border-ink bg-white shadow-[6px_6px_0_var(--ink)]">
            <figcaption className="flex items-baseline gap-3 border-b-2 border-ink bg-paper-deep px-4 py-2">
              <span className="label">Figure 1</span>
              <span className="italic">{COPY.why.caption}</span>
            </figcaption>
            <table className="w-full text-left">
              <caption className="sr-only">{COPY.why.heading}</caption>
              <tbody>
                {COPY.why.rows.map((r) => (
                  <tr key={r.label} className={`border-b border-ink last:border-b-0 ${r.highlight ? 'bg-check-soft' : ''}`}>
                    <th scope="row" className={`px-4 py-3 align-top leading-snug ${r.highlight ? 'font-bold' : 'font-normal'}`}>
                      {r.label}
                      {r.note && <sup><a href={`#src-${r.note}`} className="label ml-0.5 no-underline" aria-label={`Source ${r.note}`}>{r.note}</a></sup>}
                    </th>
                    <td className="w-[34%] px-3 py-3 align-top sm:w-[30%] sm:px-4">
                      <span className="whitespace-nowrap font-heading text-xl font-bold tabular-nums leading-none sm:text-3xl">{r.value}</span>
                      {'unit' in r && <span className="label mt-1 block text-muted">{r.unit}</span>}
                      {r.bar !== undefined && (
                        <span className="mt-1.5 block h-2 border border-ink bg-cream" aria-hidden>
                          <span className="block h-full bg-ink" style={{ width: `${r.bar}%` }} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className="border-t-2 border-ink px-4 py-2.5 text-xs leading-relaxed text-muted">
              {COPY.why.sources.map((s) => (
                <li key={s.n} id={`src-${s.n}`}>
                  <span className="label mr-1">{s.n}</span>{s.text}{' '}
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline">Source</a>
                </li>
              ))}
            </ol>
          </figure>
        </Reveal>
      </section>

      {/* pull quote */}
      <section className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-12">
        <Reveal>
          <figure className="pull-quote border-y-[6px] border-ink py-8 text-center lg:py-12">
            <blockquote className="mx-auto max-w-4xl font-heading text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              “{COPY.quote}”
            </blockquote>
            <figcaption className="mt-4 text-lg italic text-muted">{COPY.quoteAfter}</figcaption>
          </figure>
        </Reveal>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 lg:px-8 lg:py-16" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-4xl font-bold sm:text-5xl">How it works</h2>
        <ol className="grid gap-0 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {COPY.steps.map((s, i) => {
            const I = s.icon
            return (
              <li key={s.title} className="contents">
                {i > 0 && (
                  <span className="grid place-items-center py-2 lg:px-3 lg:py-0" aria-hidden>
                    <ArrowDown className="lg:hidden" size={28} strokeWidth={2.5} />
                    <ArrowRight className="hidden lg:block" size={32} strokeWidth={2.5} />
                  </span>
                )}
                <Reveal delay={i * 120} className="h-full">
                  <div className={`card flex h-full flex-col gap-2 ${s.tone}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center border-2 border-ink bg-white font-heading text-2xl font-bold">{i + 1}</span>
                      <I size={22} aria-hidden />
                      <h3 className="text-2xl font-bold">{s.title}</h3>
                    </div>
                    <p className="text-lg leading-snug">{s.text}</p>
                  </div>
                </Reveal>
              </li>
            )
          })}
        </ol>
      </section>

      {/* closing */}
      <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 pb-16 pt-4 text-center lg:px-8">
        <Blob who="sunny" mood="excited" size={84} />
        <p className="font-heading text-2xl font-bold sm:text-3xl">Chapter 1 takes about ten minutes.</p>
        <Cta />
        <p className="label text-muted">No account, no email. Chapters 1-3 are free.</p>
      </section>
    </div>
  )
}
