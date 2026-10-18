import { useState } from 'react'
import { Lock } from 'lucide-react'
import { api, WORLD_LABELS, type FeedbackAdmin } from '../api'

const METRICS = [
  { key: 'fillers_per_min', label: 'Fillers / min', lower: true },
  { key: 'wpm', label: 'Pace (wpm)', lower: false },
  { key: 'rubric_score', label: 'Rubric score', lower: false },
] as const

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(n))

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
        <div className="card bg-check-soft">
          <p className="label">Average usefulness</p>
          <p className="font-heading text-5xl font-bold">{fmt(s.avg_rating)}<span className="text-2xl text-muted"> / 5</span></p>
          <p className="label text-muted">{s.ratings} rating{s.ratings === 1 ? '' : 's'}</p>
        </div>
        <div className="card bg-target-soft">
          <p className="label">Would pay $5/month</p>
          <div className="mt-2 flex h-6 border-2 border-ink" aria-hidden>
            <span className="bg-good" style={{ width: `${s.pay.yes}%` }} />
            <span className="bg-check" style={{ width: `${s.pay.maybe}%` }} />
            <span className="bg-white" style={{ width: `${s.pay.no}%` }} />
          </div>
          <p className="mt-2 font-bold">Yes {s.pay.yes}% · Maybe {s.pay.maybe}% · No {s.pay.no}%</p>
          <p className="label text-muted">{s.pay_answers} answer{s.pay_answers === 1 ? '' : 's'}</p>
        </div>
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
            <div className="mt-2 flex flex-wrap gap-2">
              {r.rating !== null && <span className="chip bg-check-soft">Useful {r.rating}/5</span>}
              {r.pay && <span className="chip bg-target-soft">Pay: {r.pay}</span>}
              {r.before && (
                <span className="chip">
                  {METRICS.map((m) => `${m.label.split(' ')[0]} ${fmt(r.before?.[m.key])}${r.after ? ` → ${fmt(r.after[m.key])}` : ''}`).join(' · ')}
                </span>
              )}
            </div>
            {r.want_next && <p className="mt-2"><span className="label text-muted">Wants next: </span>{r.want_next}</p>}
            {r.confusing && <p className="mt-1"><span className="label text-coral-dark">Confusing / broken: </span>{r.confusing}</p>}
          </article>
        ))}
      </section>
    </div>
  )
}
