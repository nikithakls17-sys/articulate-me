import { useState } from 'react'
import { Lock } from 'lucide-react'
import { api, FEEDBACK_OPTIONS, WORLD_LABELS, type FeedbackAdmin, type FeedbackQuestion, type FeedbackRow } from '../api'

const METRICS = [
  { key: 'fillers_per_min', label: 'Fillers / min', lower: true },
  { key: 'wpm', label: 'Pace (wpm)', lower: false },
  { key: 'rubric_score', label: 'Rubric score', lower: false },
] as const

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(n))

const SCALE = [1, 2, 3, 4, 5].map((n) => [String(n), String(n)] as const)
const CHARTS: { q: FeedbackQuestion; title: string; multi?: boolean; note?: string }[] = [
  { q: 'rating', title: '1. How useful was this?' },
  { q: 'liked', title: '2. What did you like most?', multi: true },
  { q: 'off', title: '3. What felt off?', multi: true },
  { q: 'design', title: '4. How do you like the design?' },
  { q: 'retry_help', title: '5. Did the feedback help on your retry?' },
  { q: 'come_back', title: '6. Would you come back tomorrow?' },
  { q: 'pay', title: '7. Would you pay $5/month?' },
  { q: 'fair_price', title: '7b. What price feels fair?', note: 'asked after Maybe or No' },
  { q: 'who', title: '8. Who should use this?', multi: true },
]
const optionsFor = (q: FeedbackQuestion) => (q === 'rating' || q === 'design' ? SCALE : FEEDBACK_OPTIONS[q])
const labelOf = (q: keyof typeof FEEDBACK_OPTIONS, id: string) =>
  (FEEDBACK_OPTIONS[q] as readonly (readonly [string, string])[]).find(([o]) => o === id)?.[1] ?? id

/** One question: a horizontal bar per option, count and share of the people who answered it. */
function Chart({ title, multi, note, answered, counts, opts }: {
  title: string; multi?: boolean; note?: string; answered: number; counts: Record<string, number>
  opts: readonly (readonly [string, string])[]
}) {
  return (
    <figure className="card flex flex-col gap-2">
      <figcaption>
        <p className="font-bold">{title}</p>
        <p className="label text-muted">{answered} answered{multi ? ' · pick any, so shares can add past 100%' : ''}{note ? ` · ${note}` : ''}</p>
      </figcaption>
      <dl className="flex flex-col gap-1.5">
        {opts.map(([id, label]) => {
          const n = counts[id] ?? 0
          const pct = answered ? Math.round((100 * n) / answered) : 0
          return (
            <div key={id} className="grid grid-cols-[minmax(0,40%)_1fr_4.75rem] items-center gap-2 text-sm">
              <dt className="truncate" title={label}>{label}</dt>
              <dd className="h-5 border-2 border-ink bg-white"><div className="h-full bg-check" style={{ width: `${pct}%` }} /></dd>
              <dd className="text-right tabular-nums"><b>{n}</b> <span className="text-muted">· {pct}%</span></dd>
            </div>
          )
        })}
      </dl>
    </figure>
  )
}

function Answers({ r }: { r: FeedbackRow }) {
  const chips: string[] = []
  if (r.rating) chips.push(`Useful ${r.rating}/5`)
  if (r.design) chips.push(`Design ${r.design}/5`)
  if (r.liked?.length) chips.push(`Liked: ${r.liked.map((x) => labelOf('liked', x)).join(', ')}`)
  if (r.off?.length) chips.push(`Off: ${r.off.map((x) => labelOf('off', x)).join(', ')}`)
  if (r.retry_help) chips.push(`Retry helped: ${labelOf('retry_help', r.retry_help)}`)
  if (r.come_back) chips.push(`Back tomorrow: ${labelOf('come_back', r.come_back)}`)
  if (r.pay) chips.push(`Pay $5: ${labelOf('pay', r.pay)}${r.fair_price ? ` · fair ${labelOf('fair_price', r.fair_price)}` : ''}`)
  if (r.who?.length) chips.push(`For: ${r.who.map((x) => labelOf('who', x)).join(', ')}`)
  return <div className="mt-2 flex flex-wrap gap-2">{chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
}

/** Private: every feedback response plus a summary. The password stays in this tab's memory only. */
export default function AdminFeedback() {
  const [password, setPassword] = useState('')
  const [data, setData] = useState<FeedbackAdmin | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true); setError('')
    try { setData(await api.adminFeedback(password)) } catch (err) { setError((err as Error).message); setData(null) }
    setLoading(false)
  }

  if (!data) {
    return (
      <form onSubmit={load} className="card mx-auto mt-6 flex max-w-sm flex-col gap-3">
        <p className="label flex items-center gap-1.5"><Lock size={14} /> Private</p>
        <h1 className="text-3xl font-bold">Feedback responses</h1>
        <label className="font-bold">
          Admin password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-base outline-none focus:bg-white" />
        </label>
        {error && <p className="label text-coral-dark" role="alert">{error}</p>}
        <button className="btn-primary" disabled={!password || loading}>{loading ? 'Checking…' : 'Open'}</button>
      </form>
    )
  }

  const s = data.summary
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-muted">Private · feedback corner</p>
          <h1 className="text-4xl font-bold">{s.responses} response{s.responses === 1 ? '' : 's'}</h1>
        </div>
        <button className="btn-ghost px-4 py-2" onClick={() => load()}>{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {([['Average usefulness', s.avg_rating, 'rating'], ['Average design', s.avg_design, 'design']] as const).map(([t, v, q]) => (
          <div key={q} className="card bg-check-soft!">
            <p className="label">{t}</p>
            <p className="font-heading text-5xl font-bold">{fmt(v)}<span className="text-2xl text-muted"> / 5</span></p>
            <p className="label text-muted">{s.questions[q].answered} rating{s.questions[q].answered === 1 ? '' : 's'}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        {CHARTS.map((c) => <Chart key={c.q} {...c} {...s.questions[c.q]} opts={optionsFor(c.q)} />)}
      </section>

      <section className="card">
        <h2 className="text-xl font-bold">Before and after</h2>
        <p className="text-sm text-muted">First attempt (baseline when there is one) vs latest, averaged over {s.with_progress} learner{s.with_progress === 1 ? '' : 's'} with at least two attempts.</p>
        <table className="mt-3 w-full border-2 border-ink text-left">
          <thead className="label bg-paper-deep">
            <tr><th className="p-2">Metric</th><th className="p-2">Before</th><th className="p-2">After</th><th className="p-2">Change</th></tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const b = s.before[m.key], a = s.after[m.key]
              const d = b !== null && a !== null ? Math.round((a - b) * 10) / 10 : null
              const better = d !== null && d !== 0 && (m.lower ? d < 0 : d > 0)
              return (
                <tr key={m.key} className="border-t-2 border-ink">
                  <td className="p-2 font-bold">{m.label}</td>
                  <td className="p-2 tabular-nums">{fmt(b)}</td>
                  <td className="p-2 tabular-nums">{fmt(a)}</td>
                  <td className={`p-2 tabular-nums font-bold ${better ? 'text-leaf' : ''}`}>{d === null ? '–' : `${d > 0 ? '+' : ''}${d}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="label mt-1 text-muted">Pace has no single right answer; around 120 to 160 wpm is comfortable.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">All responses</h2>
        {!data.responses.length && <p className="text-muted">Nothing yet.</p>}
        {data.responses.map((r) => (
          <article key={r.id} className="border-2 border-ink bg-white p-3">
            <div className="label flex flex-wrap gap-x-3 gap-y-1 text-muted">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span>{r.context}{r.lesson ? ` · ${r.lesson}` : ''}</span>
              {r.worlds.length > 0 && <span>{r.worlds.map((w) => WORLD_LABELS[w]?.label ?? w).join(', ')}</span>}
              {r.first_name && <span className="text-ink">{r.first_name}</span>}
            </div>
            <Answers r={r} />
            {r.before && (
              <p className="label mt-2 text-muted">
                {METRICS.map((m) => `${m.label.split(' ')[0]} ${fmt(r.before?.[m.key])}${r.after ? ` → ${fmt(r.after[m.key])}` : ''}`).join(' · ')}
              </p>
            )}
            {r.improve && <p className="mt-2"><span className="label text-muted">Improve: </span>{r.improve}</p>}
            {r.want_next && <p className="mt-2"><span className="label text-muted">Wants next: </span>{r.want_next}</p>}
            {r.confusing && <p className="mt-1"><span className="label text-coral-dark">Confusing / broken: </span>{r.confusing}</p>}
          </article>
        ))}
      </section>
    </div>
  )
}
