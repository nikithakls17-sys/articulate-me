import { useState } from 'react'
import { ArrowRight, CheckCircle2, CircleDashed, CircleHelp, CircleMinus, RotateCcw, Square, Volume2, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Attempt, AttemptSummary, Status } from '../api'
import { speak, stopSpeaking } from '../voice'
import { useSession } from '../session'
import { BlobSays } from './Blob'

const STATUS: Record<Status, { icon: LucideIcon; label: string; cls: string; ic: string }> = {
  used: { icon: CheckCircle2, label: 'Used it', cls: 'border-leaf/40 bg-leaf-soft', ic: 'text-leaf' },
  partly: { icon: CircleMinus, label: 'Partly', cls: 'border-sun/50 bg-amber-50', ic: 'text-amber-600' },
  missing: { icon: CircleDashed, label: 'Not yet', cls: 'border-line bg-white', ic: 'text-muted' },
  unverified: { icon: CircleHelp, label: "Couldn't verify", cls: 'border-line bg-white', ic: 'text-muted' },
}

export default function FeedbackView({ attempt, technique, onRetry, onDone }:
  { attempt: Attempt; technique: string | null; onRetry: () => void; onDone: () => void }) {
  const [playing, setPlaying] = useState(false)
  const name = useSession().user?.name ?? 'friend'
  const score = attempt.rubric_score ?? 0
  const m = attempt.metrics
  const prev = attempt.previous

  const hearModel = async () => {
    if (playing) { stopSpeaking(); setPlaying(false); return }
    setPlaying(true)
    await speak(attempt.rewrite)
    setPlaying(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-coral">
          {technique ? `Attempt ${attempt.attempt_no}` : 'Your baseline'} · +{attempt.xp} XP
        </p>
        {attempt.rubric_score !== null && (
          <p className="text-5xl font-black">{attempt.rubric_score}<span className="text-2xl text-muted">%</span></p>
        )}
        <p className="text-sm text-muted">{technique ? `use of ${technique}` : 'of the basics'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center min-[380px]:grid-cols-4">
        <Stat label="words/min" value={m.wpm} prev={prev?.metrics.wpm} />
        <Stat label="fillers/min" value={m.fillers_per_min} prev={prev?.metrics.fillers_per_min} lowerIsBetter />
        <Stat label="seconds talking" value={Math.round(m.duration_sec)} />
        <Stat label="long pauses" value={m.pauses_over_0_7s} />
      </div>
      {m.filler_count > 0 && (
        <p className="-mt-2 text-center text-sm text-muted">
          Fillers: {Object.entries(m.fillers).map(([w, n]) => `“${w}” ×${n}`).join(', ')}
        </p>
      )}

      <BlobSays size={64} mood={!technique ? 'calm' : score >= 75 ? 'excited' : score >= 40 ? 'happy' : 'calm'}
        accessory={technique && score >= 75 ? 'cap' : 'specs'}>
        {!technique ? <>Thanks, {name}. Now I know where you're starting. Every lesson from here, we'll beat these numbers.</>
          : score >= 75 ? <>{name}, you really used {technique}! Read what I heard below.</>
          : score >= 40 ? <>Good start, {name}. One fix and you're there.</>
          : <>That's a start, {name}. Let's try one change together.</>}
      </BlobSays>

      {attempt.feedback && (
        <section className="card"><p className="text-lg font-bold leading-relaxed">{attempt.feedback}</p></section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-black">What I heard</h2>
        {attempt.rubric.map((r) => {
          const s = STATUS[r.status]
          const before = prev?.rubric?.find((p) => p.id === r.id)
          return (
            <div key={r.id} className={`rounded-2xl border-2 p-4 ${s.cls}`}>
              <div className="flex items-start gap-2">
                <s.icon className={`mt-0.5 shrink-0 ${s.ic}`} size={20} aria-label={s.label} />
                <p className="flex-1 font-extrabold">{r.check}</p>
              </div>
              {before && before.status !== r.status && (
                <p className="mt-1 pl-7 text-xs font-bold text-muted">last time: {STATUS[before.status].label}</p>
              )}
              {r.evidence && <p className="ml-7 mt-2 border-l-4 border-leaf/50 pl-3 italic text-ink/80">“{r.evidence}”</p>}
              {r.status === 'unverified' && (
                <p className="mt-1 pl-7 text-sm text-muted">The coach quoted words you didn't say, so I hid it instead of making something up.</p>
              )}
            </div>
          )
        })}
      </section>

      {(attempt.fix || attempt.rewrite) && (
        <section className="card border-sky/30 bg-blue-50">
          <p className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-sky"><Wrench size={16} /> Your one fix</p>
          <p className="mt-1 text-lg font-bold">{attempt.fix}</p>
          {attempt.rewrite && (
            <>
              <p className="mt-3 text-sm font-extrabold uppercase tracking-wide text-sky">Try saying</p>
              <p className="mt-1 text-lg italic">“{attempt.rewrite}”</p>
              <button className="chip mt-3" onClick={hearModel}>
                {playing ? <><Square size={14} /> Stop</> : <><Volume2 size={14} /> Hear the model answer</>}
              </button>
            </>
          )}
        </section>
      )}

      {prev && <Compare prev={prev} now={attempt} />}

      <details className="card text-sm">
        <summary className="cursor-pointer font-extrabold">Full conversation</summary>
        <ol className="mt-3 flex flex-col gap-2">
          {attempt.turns.map((t, i) => (
            <li key={i}>
              <span className={`font-extrabold ${t.speaker === 'user' ? 'text-coral' : 'text-sky'}`}>
                {t.speaker === 'user' ? 'You' : attempt.scenario.partner}:
              </span>{' '}
              <span className="text-ink/80">{t.text}</span>
            </li>
          ))}
        </ol>
      </details>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={onRetry}><RotateCcw size={20} /> Retry</button>
        <button className="btn-primary" onClick={onDone}>Done <ArrowRight size={20} /></button>
      </div>
    </div>
  )
}

function Stat({ label, value, prev, lowerIsBetter }: { label: string; value: number; prev?: number; lowerIsBetter?: boolean }) {
  const delta = prev === undefined ? 0 : value - prev
  const better = lowerIsBetter ? delta < 0 : delta > 0
  return (
    <div className="rounded-2xl border-2 border-line bg-white px-1 py-3">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-bold leading-tight text-muted">{label}</p>
      {prev !== undefined && delta !== 0 && (
        <p className={`text-xs font-black ${better ? 'text-leaf' : 'text-muted'}`}>{delta > 0 ? '+' : '−'}{Math.abs(Math.round(delta * 10) / 10)}</p>
      )}
    </div>
  )
}

function Compare({ prev, now }: { prev: AttemptSummary; now: Attempt }) {
  const rows: [string, string | number, string | number][] = [
    ['Technique score', `${prev.rubric_score ?? '–'}%`, `${now.rubric_score ?? '–'}%`],
    ['Fillers / min', prev.metrics.fillers_per_min, now.metrics.fillers_per_min],
    ['Words / min', prev.metrics.wpm, now.metrics.wpm],
  ]
  return (
    <section className="card">
      <h2 className="font-black">Attempt {prev.attempt_no} vs {now.attempt_no}</h2>
      <table className="mt-2 w-full text-left">
        <tbody>
          {rows.map(([k, a, b]) => (
            <tr key={k} className="border-t border-line">
              <td className="py-2 text-muted">{k}</td>
              <td className="py-2 text-right font-bold tabular-nums">{a}</td>
              <td className="py-2 text-center text-muted"><ArrowRight size={14} className="inline" /></td>
              <td className="py-2 font-black tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
