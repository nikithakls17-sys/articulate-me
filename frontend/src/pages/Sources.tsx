import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronLeft } from 'lucide-react'
import { api, type Health } from '../api'
import { useSession } from '../session'

const BOOKS = [
  {
    title: 'Stand up, Speak out: The Practice and Ethics of Public Speaking',
    note: 'University of Wisconsin–Milwaukee edition, adapted from a work originally published by Saylor Academy.',
    url: 'https://wisconsin.pressbooks.pub/uwmpublicspeaking/',
    license: 'CC BY-NC-SA 4.0',
  },
  {
    title: 'Exploring Public Speaking, 4th edition',
    note: 'Barbara G. Tucker et al.',
    url: 'https://open.maricopa.edu/exploringpublicspeaking/',
    license: 'CC BY-NC-SA 4.0',
  },
]

export default function Sources() {
  const { user, signOut } = useSession()
  const [health, setHealth] = useState<Health | null>(null)
  useEffect(() => { api.health().then(setHealth).catch(() => {}) }, [])
  const hosted = health?.mode === 'hosted'

  return (
    <div className="flex flex-col gap-5">
      <Link to="/progress" className="chip self-start"><ChevronLeft size={16} /> Back</Link>
      <h1 className="text-3xl font-black">Sources & privacy</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-black">Where the lessons come from</h2>
        <p className="text-muted">
          Every lesson is written from two openly licensed college public speaking textbooks, retrieved passage by
          passage, and each lesson cites its chapter and page. Lessons are adapted, not endorsed by the authors.
        </p>
        {BOOKS.map((b) => (
          <a key={b.url} href={b.url} target="_blank" rel="noreferrer" className="card block">
            <p className="flex items-start gap-2 font-extrabold"><BookOpen size={18} className="mt-0.5 shrink-0 text-coral" /> {b.title}</p>
            <p className="text-sm text-muted">{b.note}</p>
            <p className="mt-1 text-sm font-bold text-sky">
              Licensed <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" className="underline">{b.license}</a>
            </p>
          </a>
        ))}
        <p className="text-sm text-muted">
          Because the books are NonCommercial-licensed, the lesson text here is shared under the same CC BY-NC-SA 4.0
          license and is free. A paid tier would need original lessons.
        </p>
      </section>

      <section className="card">
        <h2 className="font-black">What happens to your voice</h2>
        <p className="mt-1 text-sm text-muted">This server is running in <b className="text-ink">{health?.mode ?? '…'} mode</b>.</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead><tr className="text-muted"><th className="py-1"></th><th>Local mode</th><th>Hosted mode</th></tr></thead>
          <tbody>
            {[
              ['Transcription', 'Whisper on your laptop', 'ElevenLabs'],
              ['Coaching + partner', 'Gemma on your laptop (Ollama)', 'Gemma on DigitalOcean'],
              ['Voice playback', 'Your browser', 'ElevenLabs'],
              ['Recordings', 'Never saved', 'Never saved'],
              ['Transcripts + scores', 'On your laptop', 'Our database'],
            ].map(([k, l, h]) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="py-2 pr-2 font-bold">{k}</td>
                <td className={`py-2 pr-2 ${!hosted ? 'font-bold text-ink' : 'text-muted'}`}>{l}</td>
                <td className={`py-2 ${hosted ? 'font-bold text-ink' : 'text-muted'}`}>{h}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Audio is transcribed and then discarded; only the text transcript and scores are kept. Model: {health?.model ?? '…'}.
        </p>
      </section>

      {user && (
        <button className="btn-ghost" onClick={signOut}>Start over as someone new</button>
      )}
    </div>
  )
}
