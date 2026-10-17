import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Highlighter, NotebookPen, Trash2 } from 'lucide-react'
import { api, type Note } from '../api'
import { useSession } from '../session'
import CitationChip from '../components/CitationChip'

function NoteCard({ note, onDelete }: { note: Note; onDelete: () => void }) {
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
    <li className="card flex flex-col gap-3">
      {note.page_title && <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{note.page_title}</p>}
      <blockquote className="border-l-4 border-sun bg-amber-50 px-3 py-2 text-[17px] leading-snug">{note.text}</blockquote>
      {note.citation && <div><CitationChip c={note.citation} /></div>}
      <label className="text-sm font-bold text-muted">
        My note
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} onBlur={save} rows={2} maxLength={1000}
          placeholder="Why this matters to me…"
          className="mt-1 w-full resize-y rounded-xl border-2 border-line bg-white p-2 font-medium text-ink outline-none focus:border-coral" />
      </label>
      <div className="flex items-center justify-between text-xs font-bold text-muted">
        <span>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</span>
        <button onClick={onDelete} className="flex items-center gap-1 rounded-lg p-1 hover:text-coral-dark" aria-label="Delete note">
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </li>
  )
}

export default function Notes() {
  const { user } = useSession()
  const [notes, setNotes] = useState<Note[] | null>(null)
  useEffect(() => { if (user) api.notes(user.id).then(setNotes) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!notes) return <div className="py-20 text-center text-muted">Loading…</div>

  const groups = new Map<number, Note[]>()
  notes.forEach((n) => groups.set(n.day, [...(groups.get(n.day) ?? []), n]))
  const remove = async (id: string) => { await api.deleteNote(id); setNotes(notes.filter((n) => n.id !== id)) }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-black">My notes</h1>
        <p className="text-muted">Highlights you saved from the textbook, with your own thoughts.</p>
      </header>
      {notes.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <NotebookPen className="text-coral" size={40} />
          <p className="font-bold">No notes yet.</p>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Highlighter size={14} /> Select any text on a chapter page and tap “Save highlight”.</p>
          <Link to="/textbook" className="btn-primary mt-2">Open the textbook</Link>
        </div>
      ) : [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([day, list]) => (
        <section key={day} className="flex flex-col gap-3">
          <h2 className="flex items-baseline justify-between">
            <span className="text-xl font-black">Day {day}: {list[0].lesson_title}</span>
            <Link to={`/read/${day}`} className="text-sm font-bold text-sky underline">Open</Link>
          </h2>
          <ul className="flex flex-col gap-3">
            {list.map((n) => <NoteCard key={n.id} note={n} onDelete={() => remove(n.id)} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}
