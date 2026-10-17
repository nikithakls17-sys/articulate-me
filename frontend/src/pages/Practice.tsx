import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Flag, Lock, MessageCircle } from 'lucide-react'
import { api, type Course } from '../api'
import { useSession } from '../session'

export default function Practice() {
  const { user } = useSession()
  const [course, setCourse] = useState<Course | null>(null)
  useEffect(() => { api.course().then(setCourse) }, [])
  if (!course || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  const base = user.days['0']
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <header className="md:col-span-2">
        <h1 className="text-3xl font-black">Practice corner</h1>
        <p className="text-muted">Short spoken conversations. The other person will push you to use each chapter's technique.</p>
      </header>

      <Link to={base?.unlocked ? '/talk/0' : '/textbook'} className={`card flex items-center gap-4 ${base?.unlocked ? '' : 'opacity-60'}`}>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${base?.practiced ? 'bg-leaf text-white' : 'bg-cream text-coral'}`}>
          {base?.practiced ? <Check strokeWidth={3} /> : <Flag />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Baseline conversation</span>
          <span className="block text-sm text-muted">
            {base?.practiced ? `Done · ${base.best_score ?? '–'}%. Redo it any time.` : base?.unlocked ? "Let's see where you're starting." : 'Unlocks after chapter 1.'}
          </span>
        </span>
      </Link>

      {course.days.filter((d) => d.day > 0).map((d) => {
        const st = user.days[String(d.day)]
        const ready = d.available && st?.unlocked && st.read
        const body = (
          <>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-black
              ${st?.practiced ? 'bg-leaf text-white' : ready ? 'bg-coral text-white' : 'bg-cream text-muted'}`}>
              {st?.practiced ? <Check strokeWidth={3} /> : ready ? <MessageCircle /> : <Lock size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">Day {d.day}: {d.title}</span>
              <span className="block text-sm text-muted">
                {st?.practiced ? `Best ${st.best_score ?? '–'}% · tap to beat it`
                  : ready ? `Use ${d.technique} in a conversation`
                  : d.available && st?.unlocked ? <span className="inline-flex items-center gap-1"><BookOpen size={12} /> Read the chapter first</span>
                  : 'Locked'}
              </span>
            </span>
          </>
        )
        return ready
          ? <Link key={d.day} to={`/talk/${d.day}`} className="card flex items-center gap-4">{body}</Link>
          : d.available && st?.unlocked
            ? <Link key={d.day} to={`/read/${d.day}`} className="card flex items-center gap-4 opacity-80">{body}</Link>
            : <div key={d.day} className="card flex items-center gap-4 opacity-60">{body}</div>
      })}
      {course.tracks.filter((t) => user.worlds.includes(t.id)).flatMap((t) => t.days).map((d) => {
        const st = user.days[String(d.day)]
        const open = d.available && st?.unlocked
        return open ? (
          <Link key={d.day} to={`/talk/${d.day}`} className="card flex items-center gap-4 border-l-[10px] border-l-target">
            <span className="min-w-0 flex-1">
              <span className="label text-target">New here</span>
              <span className="block truncate text-lg font-extrabold">{d.title}</span>
              <span className="block text-sm text-muted">{d.learn}</span>
            </span>
          </Link>
        ) : null
      })}
    </div>
  )
}
