import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Flag, Flame, Globe, Info, Lock, MessageCircle, Zap } from 'lucide-react'
import { api, type Course, type NextStep } from '../api'
import { useSession } from '../session'
import Blob, { BlobSays, blobFor, greeting, timeAccessory } from '../components/Blob'

export function stepLink(s: NextStep) {
  return s.kind === 'read' ? `/read/${s.day}` : `/talk/${s.day}`
}

const STEP_COPY = {
  read: { label: 'Read', icon: BookOpen },
  baseline: { label: "Let's see where you're starting", icon: Flag },
  practice: { label: 'Talk', icon: MessageCircle },
}

export default function CoursePage() {
  const { user, refresh } = useSession()
  const [course, setCourse] = useState<Course | null>(null)
  useEffect(() => { api.course().then(setCourse); refresh() }, [refresh])
  if (!user || !course) return <div className="py-20 text-center text-muted">Loading…</div>

  const next = user.next_step
  const nextDay = next && course.days.find((d) => d.day === (next.kind === 'baseline' ? 1 : next.day))
  const S = next ? STEP_COPY[next.kind] : null
  const lessons = course.days.filter((d) => d.day > 0)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Blob mood="happy" accessory={timeAccessory()} size={44} />
        <span className="min-w-0 flex-1 truncate font-heading text-xl font-bold">{greeting(user.name)}</span>
        <span className="chip" title="Day streak"><Flame size={16} className="text-coral" /> <b className="text-ink">{user.streak}</b></span>
        <span className="chip" title="XP"><Zap size={16} className="text-sun" /> <b className="text-ink">{user.xp}</b></span>
      </header>

      {next && nextDay && S ? (
        <Link to={stepLink(next)} className={`card block border-l-[10px] ${next.kind === 'read' ? 'border-l-read' : 'border-l-talk'}`}>
          <p className={`flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide ${next.kind === 'read' ? 'text-read' : 'text-talk'}`}>
            <S.icon size={16} /> {next.kind === 'baseline' ? 'Before we go on' : `Day ${next.day} · ${S.label}`}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight">
            {next.kind === 'baseline' ? "Let's see where you're starting" : nextDay.title}
          </h1>
          <p className="mt-1 text-muted">
            {next.kind === 'read' && `${nextDay.learn} About 3 minutes of reading and a quick check.`}
            {next.kind === 'baseline' && 'A quick two-question chat. No technique needed, just talk like you normally would.'}
            {next.kind === 'practice' && `Use ${nextDay.technique} in a short spoken conversation.`}
          </p>
          <div className="mt-3">
            <BlobSays who={blobFor(next.kind === 'baseline' ? 'Baseline' : nextDay.technique).id} size={56}>
              {next.kind === 'read' && <>{user.name}, today we learn <b>{nextDay.technique}</b>. Grab a seat, it's a short one.</>}
              {next.kind === 'baseline' && <>Before we go further, {user.name}, I want to hear how you talk right now. No pressure.</>}
              {next.kind === 'practice' && <>You've read it, {user.name}. Now let's hear {nextDay.technique} out loud.</>}
            </BlobSays>
          </div>
          <span className={`btn mt-3 w-full text-white ${next.kind === 'read' ? 'bg-read' : 'bg-talk'}`}>{next.kind === 'read' ? 'Open chapter' : 'Start talking'}</span>
        </Link>
      ) : (
        <div className="card flex flex-col items-center text-center">
          <Blob mood="proud" accessory="cap" size={72} />
          <h1 className="mt-2 text-2xl font-black">You're all caught up, {user.name}</h1>
          <p className="text-muted">Replay any conversation in Practice to beat your score.</p>
        </div>
      )}

      <Link to="/overview" className="chip self-start"><Info size={16} /> Course overview, targets and badges</Link>

      {course.tracks.filter((t) => user.worlds.includes(t.id)).map((t) => (
        <section key={t.id}>
          <div className="border-2 border-ink bg-target-soft px-4 py-3">
            <p className="label">Track</p>
            <p className="text-xl font-black">{t.title}{user.new_here && ` · ${t.countries[user.new_here.country]}`}</p>
            <p className="text-sm text-muted">{t.summary}</p>
          </div>
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {t.days.map((d) => {
              const st = user.days[String(d.day)]
              const open = d.available && st?.unlocked
              return (
                <li key={d.day} className={`card flex items-center gap-3 p-3 ${!open ? 'opacity-60' : ''}`}>
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${st?.practiced ? 'bg-leaf text-white' : 'bg-target text-white'}`}>
                    {st?.practiced ? <Check size={22} strokeWidth={3} /> : <Globe size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{d.title}</p>
                    <p className="truncate text-xs text-muted">{d.available ? d.technique : 'Being written'}{st?.best_score != null && ` · best ${st.best_score}%`}</p>
                  </div>
                  {open && (
                    <div className="flex shrink-0 gap-1.5">
                      <Link to={`/read/${d.day}`} aria-label={`Read ${d.title}`} className={`grid h-10 w-10 place-items-center border-2 border-ink ${st?.read ? 'bg-leaf-soft text-leaf' : 'bg-read-soft text-read'}`}><BookOpen size={18} /></Link>
                      <Link to={`/talk/${d.day}`} aria-label={`Talk ${d.title}`} className="grid h-10 w-10 place-items-center border-2 border-ink bg-talk text-white"><MessageCircle size={18} /></Link>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      {course.weeks.map((w) => (
        <section key={w.week} className={w.locked ? 'opacity-60' : ''}>
          <div className={`border-2 border-ink px-4 py-3 ${w.locked ? 'bg-paper-deep text-muted' : 'bg-read-soft text-ink'}`}>
            <p className="text-xs font-extrabold uppercase tracking-widest opacity-80">Week {w.week}</p>
            <p className="flex items-center gap-2 text-xl font-black">{w.title} {w.locked && <Lock size={18} />}</p>
          </div>
          {w.locked ? <p className="px-2 pt-2 text-sm text-muted">Unlocks after Week 1.</p> : (
            <ol className="mt-3 grid gap-3 md:grid-cols-2">
              {lessons.map((d) => {
                const st = user.days[String(d.day)]
                const base = user.days['0']
                const open = d.available && st?.unlocked
                return (
                  <li key={d.day}>
                    <div className={`card flex items-center gap-3 p-3 ${!open ? 'opacity-60' : ''}`}>
                      {open ? (
                        <span className="relative shrink-0" title={`${blobFor(d.technique).name}: ${blobFor(d.technique).skill}`}>
                          <Blob who={blobFor(d.technique).id} size={52} />
                          <span className={`label absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center border-2 border-ink px-0.5 ${st?.practiced ? 'bg-leaf text-white' : 'bg-white'}`}>
                            {st?.practiced ? <Check size={12} strokeWidth={3} /> : d.day}
                          </span>
                        </span>
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cream text-muted"><Lock size={18} /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold">{d.title}{d.pro && <span className="ml-1.5 rounded bg-sun px-1 text-[10px] font-black">PRO</span>}</p>
                        <p className="truncate text-xs text-muted">{d.technique}{st?.best_score != null && ` · best ${st.best_score}%`}</p>
                      </div>
                      {open && (
                        <div className="flex shrink-0 gap-1.5">
                          <Link to={`/read/${d.day}`} aria-label={`Read day ${d.day}`}
                            className={`grid h-10 w-10 place-items-center border-2 border-ink ${st?.read ? 'bg-leaf-soft text-leaf' : 'bg-read-soft text-read'}`}>
                            <BookOpen size={18} />
                          </Link>
                          {st?.read ? (
                            <Link to={`/talk/${d.day}`} aria-label={`Talk day ${d.day}`}
                              className={`grid h-10 w-10 place-items-center border-2 border-ink ${st?.practiced ? 'bg-leaf-soft text-leaf' : 'bg-talk text-white'}`}>
                              <MessageCircle size={18} />
                            </Link>
                          ) : (
                            <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-line text-muted" title="Read the chapter first">
                              <MessageCircle size={18} />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {d.day === 1 && st?.read && (
                      <Link to="/talk/0" className={`ml-6 mt-2 flex items-center gap-2 rounded-2xl border-2 border-dashed p-3 text-sm font-extrabold
                        ${base?.practiced ? 'border-leaf/40 text-leaf' : 'border-coral/50 text-coral'}`}>
                        <Flag size={16} /> {base?.practiced ? `Baseline recorded · ${base.best_score ?? '–'}%` : "Baseline: let's see where you're starting"}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}
