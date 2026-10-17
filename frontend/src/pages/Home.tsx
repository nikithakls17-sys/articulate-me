import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, WORLD_LABELS, type Course } from '../api'
import { useSession } from '../session'

const OFFSETS = ['translate-x-0', 'translate-x-12', 'translate-x-16', 'translate-x-8', '-translate-x-8', '-translate-x-16', '-translate-x-12', 'translate-x-0']

export default function Home() {
  const { user, refresh } = useSession()
  const [course, setCourse] = useState<Course | null>(null)

  useEffect(() => { api.course().then(setCourse); refresh() }, [refresh])

  if (!user) return null
  const done = new Set(user.completed_days)
  const next = course?.days.find((d) => d.day === user.next_day)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <span className="chip text-base">{WORLD_LABELS[user.world].emoji} {user.name}</span>
        <div className="flex gap-2">
          <span className="chip text-base" title="Day streak">🔥 <b className="text-ink">{user.streak}</b></span>
          <span className="chip text-base" title="XP">⚡ <b className="text-ink">{user.xp}</b> XP</span>
        </div>
      </header>

      {next ? (
        <Link to={`/day/${next.day}`} className="card block border-coral bg-white shadow-[0_6px_0_var(--color-line)]">
          <p className="text-sm font-extrabold uppercase tracking-wide text-coral">
            {user.done_today ? 'Keep going' : "Today's lesson"} · Day {next.day}
          </p>
          <h1 className="mt-1 text-3xl font-black">{next.title}</h1>
          <p className="mt-1 text-muted">{next.day === 0 ? 'Record your 60-second baseline.' : `Technique: ${next.technique}. About 5 minutes.`}</p>
          <span className="btn-primary mt-4 w-full">Start</span>
        </Link>
      ) : (
        <div className="card text-center">
          <div className="text-5xl">🏁</div>
          <h1 className="mt-2 text-2xl font-black">You're all caught up</h1>
          <p className="text-muted">Replay any day below to beat your score. New days are on the way.</p>
        </div>
      )}

      {course?.weeks.map((w) => {
        const days = w.week === 1 ? course.days : []
        return (
          <section key={w.week} className={w.locked ? 'opacity-60' : ''}>
            <div className={`rounded-2xl px-4 py-3 font-black text-white ${w.locked ? 'bg-muted' : 'bg-sky'}`}>
              <p className="text-xs uppercase tracking-widest opacity-80">Week {w.week}</p>
              <p className="text-xl">{w.title} {w.locked && '🔒'}</p>
            </div>
            {w.locked ? (
              <p className="px-2 pt-2 text-sm text-muted">Unlocks after Week 1.</p>
            ) : (
              <ol className="flex flex-col items-center gap-5 py-6">
                {days.map((d, i) => {
                  const isDone = done.has(d.day)
                  const isNext = d.day === user.next_day
                  const open = d.available && (isDone || isNext)
                  const node = (
                    <span className={`grid h-20 w-20 place-items-center rounded-full border-4 text-2xl font-black
                      ${isDone ? 'border-leaf bg-leaf text-white shadow-[0_6px_0_#227544]'
                        : isNext ? 'border-coral bg-coral text-white shadow-[0_6px_0_var(--color-coral-dark)] animate-pulse'
                        : 'border-line bg-white text-muted shadow-[0_6px_0_var(--color-line)]'}`}>
                      {isDone ? '✓' : d.available ? d.day : '🔒'}
                    </span>
                  )
                  return (
                    <li key={d.day} className={`flex flex-col items-center ${OFFSETS[i % OFFSETS.length]}`}>
                      {open ? <Link to={`/day/${d.day}`} aria-label={`Day ${d.day}: ${d.title}`}>{node}</Link> : node}
                      <span className="mt-2 text-center text-sm font-extrabold">
                        {d.title}{d.pro && <span className="ml-1 rounded bg-sun px-1 text-[10px] text-ink">PRO</span>}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
