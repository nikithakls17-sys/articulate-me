import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Highlighter, Pause, Play, RotateCcw, Target, Trash2 } from 'lucide-react'
import { api, type Note, type Progress } from '../api'
import { useSession } from '../session'
import { mmss, useStudy, type StudyTab } from '../study'
import CitationChip from './CitationChip'
import BadgeIcon from './BadgeIcon'
import Hourglass from './Hourglass'
import Blob, { BlobSays } from './Blob'

const TABS: { id: StudyTab; label: string; on: string }[] = [
  { id: 'notes', label: 'Notes', on: 'bg-notes-soft' },
  { id: 'targets', label: 'Targets', on: 'bg-target-soft' },
  { id: 'timer', label: 'Timer', on: 'bg-timer-soft' },
]

export default function StudyPanel({ compact = false }: { compact?: boolean }) {
  const { tab, setTab } = useStudy()
  return (
    <div className="flex h-full min-h-0 flex-col border-2 border-ink bg-white shadow-[4px_4px_0_var(--ink)]">
      <div role="tablist" aria-label="Study tools" className="grid grid-cols-3 border-b-2 border-ink">
        {TABS.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`label py-2.5 ${i > 0 ? 'border-l-2 border-ink' : ''} ${tab === t.id ? `${t.on} border-b-4 border-b-ink font-bold` : 'bg-white hover:bg-cream'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
        {tab === 'notes' && <NotesTab />}
        {tab === 'targets' && <TargetsTab />}
        {tab === 'timer' && <TimerTab />}
      </div>
    </div>
  )
}

export function NoteCard({ note, onDelete }: { note: Note; onDelete: () => void }) {
  const [comment, setComment] = useState(note.comment)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = async () => {
    if (comment === note.comment) return
    setState('saving')
    await api.editNote(note.id, comment)
    note.comment = comment
    setState('saved')
    window.setTimeout(() => setState('idle'), 1500)
  }
  return (
    <li className="flex flex-col gap-2 border-2 border-ink bg-white p-3">
      {note.page_title && <p className="label text-muted">{note.page_title}</p>}
      <blockquote className="border-l-4 border-notes bg-notes-soft px-2.5 py-1.5 leading-snug">{note.text}</blockquote>
      {note.citation && <div><CitationChip c={note.citation} /></div>}
      <label className="label text-muted">
        My note
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} onBlur={save} rows={2} maxLength={1000}
          placeholder="Why this matters to me…"
          className="mt-1 w-full resize-y border-2 border-ink bg-cream p-2 font-serif text-base normal-case tracking-normal text-ink outline-none focus:bg-white" />
      </label>
      <div className="label flex items-center justify-between text-muted">
        <span>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</span>
        <button onClick={onDelete} className="flex items-center gap-1 p-1 hover:text-coral-dark" aria-label="Delete note">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </li>
  )
}

function NotesTab() {
  const { user } = useSession()
  const { notesVersion } = useStudy()
  const [notes, setNotes] = useState<Note[] | null>(null)
  useEffect(() => { if (user) api.notes(user.id).then(setNotes) }, [user?.id, notesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!notes) return <p className="text-muted">Loading…</p>
  if (!notes.length) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Blob mood="sleepy" accessory="nightcap" size={72} />
        <p className="font-heading text-lg font-bold">No notes yet, {user?.name}.</p>
        <p className="flex items-center gap-1.5 text-muted"><Highlighter size={16} /> Select any text in a chapter and tap “Save highlight”.</p>
        <Link to="/textbook" className="btn-ghost mt-2">Open the textbook</Link>
      </div>
    )
  }
  const groups = new Map<number, Note[]>()
  notes.forEach((n) => groups.set(n.day, [...(groups.get(n.day) ?? []), n]))
  const remove = async (id: string) => { await api.deleteNote(id); setNotes(notes.filter((n) => n.id !== id)) }
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].sort((a, b) => a[0] - b[0]).map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-1">
            <span className="text-lg font-bold">Ch. {day}: {list[0].lesson_title}</span>
            <Link to={`/read/${day}`} className="label text-sky underline">Open</Link>
          </h3>
          <ul className="flex flex-col gap-3">
            {list.map((n) => <NoteCard key={n.id} note={n} onDelete={() => remove(n.id)} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Bar({ value, done }: { value: number; done?: boolean }) {
  return (
    <div className="mt-1.5 h-3 border-2 border-ink bg-cream">
      <div className={`h-full ${done ? 'bg-leaf' : 'bg-coral'}`} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  )
}

function TargetsTab() {
  const { user } = useSession()
  const { seconds, goalMin, targetsVersion } = useStudy()
  const [p, setP] = useState<Progress | null>(null)
  useEffect(() => { if (user) api.progress(user.id).then(setP) }, [user?.id, targetsVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <p className="text-muted">Loading…</p>
  const goalDone = seconds >= goalMin * 60
  const name = user?.name
  const locked = p.badges.filter((b) => !b.earned)
  return (
    <div className="flex flex-col gap-5">
      <BlobSays mood="listening" size={52}>{name}, here's what we're aiming for.</BlobSays>
      <section>
        <p className="label text-timer">Today</p>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-heading text-lg font-bold">Study {goalMin} minutes</span>
          <span className="label text-muted">{mmss(seconds)} / {goalMin}:00</span>
        </div>
        <Bar value={seconds / (goalMin * 60)} done={goalDone} />
      </section>
      <section>
        <p className="label text-read">Course</p>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-heading text-lg font-bold">{p.lessons_total - p.lessons_done} lessons left</span>
          <span className="label text-muted">{p.lessons_done}/{p.lessons_total}</span>
        </div>
        <Bar value={p.lessons_done / p.lessons_total} />
      </section>
      <section className="flex flex-col gap-2">
        <p className="label text-target">Targets</p>
        {p.targets.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            {t.done ? <Check size={18} className="shrink-0 text-leaf" strokeWidth={3} /> : <Target size={18} className="shrink-0 text-coral" />}
            <span className="flex-1 leading-tight">{t.title}</span>
            <span className="label text-muted">{t.current == null ? '–' : t.lower ? t.current : `${t.current}/${t.goal}`}</span>
          </div>
        ))}
      </section>
      <section>
        <p className="label text-target">Badges to reach</p>
        <ul className="mt-2 flex flex-col gap-2">
          {locked.slice(0, 4).map((b) => (
            <li key={b.id} className="flex items-center gap-3">
              <BadgeIcon id={b.id} earned={false} size={40} />
              <span><span className="block font-bold leading-tight">{b.title}</span><span className="text-sm text-muted">{b.desc}</span></span>
            </li>
          ))}
          {!locked.length && <li className="text-muted">Every badge earned.</li>}
        </ul>
      </section>
    </div>
  )
}

function TimerTab() {
  const { user } = useSession()
  const { seconds, goalMin, setGoalMin, running, startTimer, pauseTimer, resetTimer } = useStudy()
  const goal = goalMin * 60
  const left = Math.max(0, goal - seconds)
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex items-end gap-3">
        <Hourglass progress={seconds / goal} size={120} />
        <Blob mood={!left ? 'proud' : running ? 'calm' : 'sleepy'} accessory={!left ? 'cap' : running ? 'coffee' : 'nightcap'} size={64} />
      </div>
      <p className="text-lg">{!left ? `Goal met, ${user?.name}. Proud of you.` : running ? `Keep going, ${user?.name}. ${Math.ceil(left / 60)} minutes to today's goal.` : `Ready when you are, ${user?.name}. Press Start when you begin.`}</p>
      <div>
        <p className="font-heading text-4xl font-bold tabular-nums">{mmss(seconds)}</p>
        <p className="label text-muted">studied today</p>
      </div>
      <div className="grid w-full grid-cols-2 border-2 border-ink">
        <div className="p-2"><p className="font-heading text-xl font-bold tabular-nums">{goalMin}:00</p><p className="label text-muted">daily goal</p></div>
        <div className="border-l-2 border-ink p-2"><p className="font-heading text-xl font-bold tabular-nums">{mmss(left)}</p><p className="label text-muted">{left ? 'left' : 'goal met'}</p></div>
      </div>
      <div className="grid w-full grid-cols-[1fr_auto] gap-2">
        {running
          ? <button className="btn bg-timer text-white" onClick={pauseTimer}><Pause size={18} fill="currentColor" /> Pause</button>
          : <button className="btn bg-timer-soft" onClick={startTimer}><Play size={18} fill="currentColor" /> {seconds ? 'Resume' : 'Start studying'}</button>}
        <button className="btn-ghost px-3" onClick={resetTimer} disabled={!seconds && !running} aria-label="Reset today's time"><RotateCcw size={18} /></button>
      </div>
      <div className="w-full">
        <p className="label text-left">Daily goal</p>
        <div className="mt-1 grid grid-cols-4 border-2 border-ink">
          {[10, 15, 20, 30].map((m, i) => (
            <button key={m} onClick={() => setGoalMin(m)} aria-pressed={goalMin === m}
              className={`label py-2 ${i ? 'border-l-2 border-ink' : ''} ${goalMin === m ? 'bg-ink text-white' : 'bg-white'}`}>{m} min</button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">Time only counts while the timer is running. Press Start when you sit down to study and Pause when you stop. It resets at midnight.</p>
    </div>
  )
}
