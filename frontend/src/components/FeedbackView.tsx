import { useState } from 'react'
import type { Attempt, AttemptSummary, Lesson, Status } from '../api'
import { speak, stopSpeaking } from '../voice'

const STATUS: Record<Status, { icon: string; label: string; cls: string }> = {
  used: { icon: '✅', label: 'Used it', cls: 'border-leaf/40 bg-leaf-soft' },
  partly: { icon: '🟡', label: 'Partly', cls: 'border-sun/50 bg-amber-50' },
  missing: { icon: '⭕', label: 'Not yet', cls: 'border-line bg-white' },
  unverified: { icon: '❔', label: "Couldn't verify", cls: 'border-line bg-white' },
}

export default function FeedbackView({ attempt, lesson, onRetry, onDone }:
  { attempt: Attempt; lesson: Lesson; onRetry: () => void; onDone: () => void }) {
  const [playing, setPlaying] = useState(false)
  const m = attempt.metrics
  const prev = attempt.previous

  const hearModel = () => {
    if (playing) { stopSpeaking(); setPlaying(false); return }
    setPlaying(true)
    speak(attempt.rewrite, () => setPlaying(false))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-coral">
          {lesson.day === 0 ? 'Your baseline' : `Attempt ${attempt.attempt_no}`} · +{attempt.xp} XP
        </p>
        {attempt.rubric_score !== null && (
          <p className="text-5xl font-black">{attempt.rubric_score}<span className="text-2xl text-muted">%</span></p>
        )}
        <p className="text-sm text-muted">{lesson.day === 0 ? 'of the basics' : `use of ${lesson.technique}`}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="words/min" value={m.wpm} prev={prev?.metrics.wpm} />
        <Stat label="fillers/min" value={m.fillers_per_min} prev={prev?.metrics.fillers_per_min} lowerIsBetter />
        <Stat label="seconds" value={Math.round(m.duration_sec)} />
        <Stat label="long pauses" value={m.pauses_over_0_7s} />
      </div>
      {m.filler_count > 0 && (
        <p className="-mt-2 text-center text-sm text-muted">
          Fillers: {Object.entries(m.fillers).map(([w, n]) => `“${w}” ×${n}`).join(', ')}
        </p>
      )}

      <section className="card bg-white">
        <p className="text-lg font-bold leading-relaxed">{attempt.feedback}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-black">What I heard</h2>
        {attempt.rubric.map((r) => {
          const s = STATUS[r.status]
          const before = prev?.rubric?.find((p) => p.id === r.id)
          return (
            <div key={r.id} className={`rounded-2xl border-2 p-4 ${s.cls}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold">{s.icon} {r.check}</p>
                {before && before.status !== r.status && (
                  <span className="shrink-0 text-xs font-bold text-muted">was: {STATUS[before.status].label}</span>
                )}
              </div>
              {r.evidence && <p className="mt-2 border-l-4 border-leaf/50 pl-3 italic text-ink/80">“{r.evidence}”</p>}
              {r.status === 'unverified' && (
                <p className="mt-1 text-sm text-muted">The coach quoted words you didn't say, so I hid it rather than make something up.</p>
              )}
            </div>
          )
        })}
      </section>

      <section className="card border-sky/30 bg-blue-50">
        <p className="text-sm font-extrabold uppercase tracking-wide text-sky">Your one fix</p>
        <p className="mt-1 text-lg font-bold">{attempt.fix}</p>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-wide text-sky">Try saying</p>
        <p className="mt-1 text-lg italic">“{attempt.rewrite}”</p>
        <button className="chip mt-3" onClick={hearModel}>{playing ? '⏹ Stop' : '🔊 Hear the model answer'}</button>
      </section>

      {prev && <Compare prev={prev} now={attempt} />}

      <details className="card text-sm">
        <summary className="cursor-pointer font-extrabold">Your transcript</summary>
        <p className="mt-2 leading-relaxed text-muted">{attempt.transcript}</p>
      </details>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={onRetry}>↻ Retry</button>
        <button className="btn-primary" onClick={onDone}>Done</button>
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
        <p className={`text-xs font-black ${better ? 'text-leaf' : 'text-muted'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 10) / 10)}</p>
      )}
    </div>
  )
}

function Compare({ prev, now }: { prev: AttemptSummary; now: Attempt }) {
  const rows: [string, string | number, string | number][] = [
    ['Technique score', `${prev.rubric_score ?? '–'}%`, `${now.rubric_score ?? '–'}%`],
    ['Fillers / min', prev.metrics.fillers_per_min, now.metrics.fillers_per_min],
    ['Words / min', prev.metrics.wpm, now.metrics.wpm],
    ['Seconds', Math.round(prev.metrics.duration_sec), Math.round(now.metrics.duration_sec)],
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
              <td className="py-2 text-center text-muted">→</td>
              <td className="py-2 font-black tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
