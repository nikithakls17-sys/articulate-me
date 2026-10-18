import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Clock, Lock, MessageCircle, Target } from 'lucide-react'
import { api, WORLD_LABELS, type Course } from '../api'
import { useSession } from '../session'
import BadgeIcon from '../components/BadgeIcon'
import { BlobSays } from '../components/Blob'

export default function Overview() {
  const { user } = useSession()
  const [course, setCourse] = useState<Course | null>(null)
  const isNew = useSearchParams()[0].get('new') === '1'
  useEffect(() => { api.course().then(setCourse) }, [])
  if (!course || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  const lessons = course.days.filter((d) => d.day > 0)
  const firstChapter = lessons.find((d) => d.available)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-extrabold uppercase tracking-wide text-coral">{isNew ? `Welcome, ${user.name}` : 'Course overview'}</p>
        <h1 className="text-3xl font-black leading-tight">Your speaking course</h1>
        <p className="mt-1 text-muted">
          Built for {user.worlds.map((w) => WORLD_LABELS[w].label.toLowerCase()).join(' + ')}
          {user.goals.length > 0 && <> · focused on {user.goals.join(', ').toLowerCase()}</>}.
        </p>
      </header>

      <BlobSays mood="calm" accessory="specs" size={64}>
        {user.name}, here's the plan I put together for you. Short chapters, then we practise out loud together.
      </BlobSays>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [BookOpen, `${course.overview.lessons}`, 'chapters'],
          [Clock, `~${course.overview.minutes_per_lesson} min`, 'a day'],
          [MessageCircle, `${course.overview.lessons}`, 'conversations'],
        ].map(([Icon, v, l], i) => {
          const I = Icon as typeof BookOpen
          return (
            <div key={i} className="card px-2 py-4">
              <I className="mx-auto text-coral" size={22} aria-hidden />
              <p className="mt-1 text-xl font-black">{v as string}</p>
              <p className="text-xs font-bold text-muted">{l as string}</p>
            </div>
          )
        })}
      </div>

      <section className="card">
        <h2 className="font-black">How every day works</h2>
        <ol className="mt-3 space-y-3">
          {[
            ['Read', 'A short illustrated chapter from a real public speaking textbook (about 3 min).'],
            ['Check', 'Three quick questions to make sure it clicked.'],
            ['Talk', 'A short spoken conversation where the other person makes you use the technique.'],
            ['Feedback', 'Your own words quoted back, one fix, and a retry.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral text-sm font-black text-white">{i + 1}</span>
              <p><b>{t}.</b> <span className="text-muted">{d}</span></p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">What you'll learn</h2>
        {course.weeks.map((w) => (
          <div key={w.week} className={`card ${w.locked ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-widest text-sky">Week {w.week}</p>
              {w.locked && <Lock size={16} className="text-muted" aria-label="Locked" />}
            </div>
            <p className="text-lg font-black">{w.title}</p>
            <p className="text-sm text-muted">{w.summary}</p>
            {w.week === 1 && (
              <ol className="mt-3 divide-y divide-line">
                {lessons.map((d) => (
                  <li key={d.day} className="flex items-baseline gap-3 py-2">
                    <span className="w-5 shrink-0 text-sm font-black text-muted">{d.day}</span>
                    <span className="min-w-0">
                      <span className="font-extrabold">{d.title}</span>
                      {d.pro && <span className="ml-2 rounded bg-sun px-1 text-[10px] font-black">PRO</span>}
                      <span className="block text-sm text-muted">{d.learn}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-2 md:grid-cols-2">
        <h2 className="text-xl font-black md:col-span-2">Targets to hit</h2>
        {course.targets.map((t) => (
          <div key={t.id} className="card flex items-center gap-3 py-3">
            <Target className="shrink-0 text-coral" size={22} aria-hidden />
            <span className="font-bold">{t.title}</span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-black">Badges you can earn</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-5">
          {course.badges.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 text-center">
              <BadgeIcon id={b.id} />
              <p className="text-xs font-extrabold leading-tight">{b.title}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="card bg-leaf-soft! border-leaf/30 text-sm">
        <b>After your first chapter</b> we'll have a quick 2-question chat to see where you're starting. That's your
        “before” picture for the progress chart.
      </div>

      {firstChapter
        ? <Link to={isNew ? `/read/${firstChapter.day}` : '/'} className="btn-primary">{isNew ? 'Start chapter 1' : 'Back to my course'}</Link>
        : <p className="text-center text-muted">Chapters are being written. Check back soon.</p>}
    </div>
  )
}
