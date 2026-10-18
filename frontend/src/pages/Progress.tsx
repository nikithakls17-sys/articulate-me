import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, ChevronRight, Flame, Info, MessageCircle, MessageSquareText, Shield, Target } from 'lucide-react'
import { api, type AttemptSummary, type Progress } from '../api'
import { useSession } from '../session'
import BadgeIcon from '../components/BadgeIcon'
import { BlobSays } from '../components/Blob'

export default function ProgressPage() {
  const { user } = useSession()
  const [p, setP] = useState<Progress | null>(null)
  useEffect(() => { if (user) api.progress(user.id).then(setP) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <div className="py-20 text-center text-muted">Loading…</div>
  const earned = p.badges.filter((b) => b.earned).length

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-black">Progress</h1>
      <BlobSays mood="proud" accessory="cap" size={64}>
        {p.lessons_done ? `${user?.name}, look how far you've come. ${p.lessons_done} conversation${p.lessons_done > 1 ? 's' : ''} down.` : `${user?.name}, this is where your progress will show up. Let's fill it in together.`}
      </BlobSays>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [BookOpen, p.chapters_read, 'chapters read'],
          [MessageCircle, `${p.lessons_done}/${p.lessons_total}`, 'conversations'],
          [Flame, p.streak, 'day streak'],
        ].map(([Icon, v, l], i) => {
          const I = Icon as typeof BookOpen
          return (
            <div key={i} className="card px-1 py-4">
              <I className="mx-auto text-coral" size={22} aria-hidden />
              <p className="mt-1 text-2xl font-black tabular-nums">{v as string}</p>
              <p className="text-[11px] font-bold leading-tight text-muted">{l as string}</p>
            </div>
          )
        })}
      </div>

      {p.baseline && p.latest && p.latest.id !== p.baseline.id ? (
        <>
          <h2 className="text-xl font-black">Day 0 vs now</h2>
          <Duel label="Filler words per minute" hint="lower is better" a={p.baseline.metrics.fillers_per_min} b={p.latest.metrics.fillers_per_min} lowerIsBetter />
          <Duel label="Words per minute" hint="140–160 is easy to follow" a={p.baseline.metrics.wpm} b={p.latest.metrics.wpm} />
        </>
      ) : (
        <div className="card text-sm text-muted">
          {p.baseline ? 'Finish a practice conversation to see your before and after.' : "Your before/after chart starts after the baseline conversation (right after chapter 1)."}
        </div>
      )}

      {p.history.length > 1 && (
        <section className="card">
          <h2 className="font-black">Fillers per minute, every conversation</h2>
          <Spark points={p.history} />
        </section>
      )}

      <section className="grid gap-2 md:grid-cols-2">
        <h2 className="text-xl font-black md:col-span-2">Targets</h2>
        {p.targets.map((t) => {
          const pct = t.current == null ? 0 : t.lower ? (t.done ? 100 : Math.max(5, Math.min(95, (t.goal / Math.max(t.current, 0.1)) * 100)))
            : Math.min(100, (t.current / t.goal) * 100)
          return (
            <div key={t.id} className="card py-3">
              <div className="flex items-center gap-2">
                {t.done ? <Check className="shrink-0 text-leaf" size={20} strokeWidth={3} /> : <Target className="shrink-0 text-coral" size={20} />}
                <span className="flex-1 font-bold">{t.title}</span>
                <span className="text-sm font-black tabular-nums text-muted">
                  {t.current == null ? '–' : t.lower ? `${t.current} now` : `${t.current}/${t.goal}`}
                </span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-cream">
                <div className={`h-2.5 rounded-full ${t.done ? 'bg-leaf' : 'bg-coral'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      <section>
        <h2 className="text-xl font-black">Badges <span className="text-base text-muted">{earned}/{p.badges.length}</span></h2>
        <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-5">
          {p.badges.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 text-center" title={b.desc}>
              <BadgeIcon id={b.id} earned={b.earned} />
              <p className={`text-xs font-extrabold leading-tight ${b.earned ? '' : 'text-muted'}`}>{b.title}</p>
              <p className="text-[10px] leading-tight text-muted">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {p.by_day.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-black">Best conversation each day</h2>
          {p.by_day.map((a) => (
            <Link key={a.id} to={`/talk/${a.day}`} className="card flex items-center gap-3 py-3">
              <span className="w-14 shrink-0 font-extrabold">{a.day === 0 ? 'Base' : `Day ${a.day}`}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{a.metrics.fillers_per_min} fillers/min · {a.metrics.wpm} wpm</span>
              <span className="text-xl font-black">{a.rubric_score ?? '–'}%</span>
            </Link>
          ))}
        </section>
      )}

      <Link to="/feedback" className="card flex items-center gap-3">
        <MessageSquareText className="text-check" size={22} />
        <span className="flex-1 font-bold">Give feedback</span>
        <ChevronRight className="text-muted" />
      </Link>
      <Link to="/about" className="card flex items-center gap-3">
        <Info className="text-talk" size={22} />
        <span className="flex-1 font-bold">About Articulate Me & the Blob squad</span>
        <ChevronRight className="text-muted" />
      </Link>
      <Link to="/sources" className="card flex items-center gap-3">
        <Shield className="text-sky" size={22} />
        <span className="flex-1 font-bold">Sources & privacy</span>
        <ChevronRight className="text-muted" />
      </Link>
    </div>
  )
}

function Duel({ label, hint, a, b, unit = '', lowerIsBetter }: { label: string; hint: string; a: number; b: number; unit?: string; lowerIsBetter?: boolean }) {
  const max = Math.max(a, b, 1)
  const better = lowerIsBetter ? b < a : b > a
  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-black">{label}</h3>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      {([['Day 0', a, 'bg-line'], ['Now', b, better ? 'bg-leaf' : 'bg-sun']] as const).map(([name, v, cls]) => (
        <div key={name} className="mt-3 flex items-center gap-3">
          <span className="w-12 text-sm font-bold text-muted">{name}</span>
          <div className="h-7 flex-1 rounded-full bg-cream">
            <div className={`h-7 rounded-full ${cls}`} style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
          </div>
          <span className="w-12 text-right font-black tabular-nums">{v}{unit}</span>
        </div>
      ))}
    </section>
  )
}

function Spark({ points }: { points: AttemptSummary[] }) {
  const vals = points.map((p) => p.metrics.fillers_per_min)
  const max = Math.max(...vals, 1)
  const w = 300, h = 90
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 16) + 8, h - 8 - (v / max) * (h - 16)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Fillers per minute over time">
      <polyline fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinejoin="round" points={xy.map((p) => p.join(',')).join(' ')} />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--color-coral)"><title>{`${points[i].day === 0 ? 'Baseline' : `Day ${points[i].day}`}: ${vals[i]}`}</title></circle>)}
    </svg>
  )
}
