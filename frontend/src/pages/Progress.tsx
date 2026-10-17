import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AttemptSummary, type Progress } from '../api'
import { useSession } from '../session'

export default function ProgressPage() {
  const { user } = useSession()
  const [p, setP] = useState<Progress | null>(null)
  useEffect(() => { if (user) api.progress(user.id).then(setP) }, [user])
  if (!p) return <div className="py-20 text-center text-muted">Loading…</div>
  if (!p.baseline) {
    return (
      <div className="card mt-8 text-center">
        <p className="text-5xl">📈</p>
        <p className="mt-2 text-lg font-bold">Record your Day 0 baseline to start tracking.</p>
        <Link to="/day/0" className="btn-primary mt-4 w-full">Record baseline</Link>
      </div>
    )
  }
  const latest = p.latest!
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-black">Day 0 vs now</h1>
      <Duel label="Filler words per minute" hint="lower is better" a={p.baseline.metrics.fillers_per_min} b={latest.metrics.fillers_per_min} lowerIsBetter />
      <Duel label="Words per minute" hint="140–160 is easy to follow" a={p.baseline.metrics.wpm} b={latest.metrics.wpm} />
      <Duel label="Technique score" hint="% of the day's checklist used" a={p.baseline.rubric_score ?? 0} b={latest.rubric_score ?? 0} unit="%" />

      <section className="card">
        <h2 className="font-black">Fillers per minute, every attempt</h2>
        <Spark points={p.history} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-black">Best attempt each day</h2>
        {p.by_day.map((a) => (
          <Link key={a.id} to={`/day/${a.day}`} className="card flex items-center justify-between py-3">
            <span className="font-extrabold">Day {a.day}</span>
            <span className="text-sm text-muted">{a.metrics.fillers_per_min} fillers/min · {a.metrics.wpm} wpm</span>
            <span className="text-xl font-black">{a.rubric_score ?? '–'}%</span>
          </Link>
        ))}
      </section>
    </div>
  )
}

function Duel({ label, hint, a, b, unit = '', lowerIsBetter }: { label: string; hint: string; a: number; b: number; unit?: string; lowerIsBetter?: boolean }) {
  const max = Math.max(a, b, 1)
  const better = lowerIsBetter ? b < a : b > a
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-black">{label}</h2>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      {[['Day 0', a, 'bg-line'], ['Now', b, better ? 'bg-leaf' : 'bg-sun']].map(([name, v, cls]) => (
        <div key={name as string} className="mt-3 flex items-center gap-3">
          <span className="w-12 text-sm font-bold text-muted">{name}</span>
          <div className="h-7 flex-1 rounded-full bg-cream">
            <div className={`h-7 rounded-full ${cls}`} style={{ width: `${Math.max(4, ((v as number) / max) * 100)}%` }} />
          </div>
          <span className="w-14 text-right font-black tabular-nums">{v}{unit}</span>
        </div>
      ))}
    </section>
  )
}

function Spark({ points }: { points: AttemptSummary[] }) {
  const vals = points.map((p) => p.metrics.fillers_per_min)
  if (vals.length < 2) return <p className="mt-2 text-sm text-muted">Do a couple more attempts to see a trend.</p>
  const max = Math.max(...vals, 1)
  const w = 300, h = 90
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 16) + 8, h - 8 - (v / max) * (h - 16)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Fillers per minute over time">
      <polyline fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinejoin="round" points={xy.map((p) => p.join(',')).join(' ')} />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--color-coral)"><title>{`Day ${points[i].day}: ${vals[i]}`}</title></circle>)}
    </svg>
  )
}
