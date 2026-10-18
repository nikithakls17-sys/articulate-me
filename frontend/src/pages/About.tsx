import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, MessageCircle, Shield, Sparkles } from 'lucide-react'
import Blob, { BlobSays, SQUAD } from '../components/Blob'
import { useSession } from '../session'

/** About Articulate Me, and the Blob squad: one colour, one speaking skill. */
export default function About() {
  const { user } = useSession()
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="label text-talk">About</p>
        <h1 className="text-4xl font-bold leading-tight">Articulate Me</h1>
        <p className="text-lg">
          Everyone says “get to the point.” Nobody teaches how. Articulate Me is a small daily speaking course: read one
          real technique from an open public speaking textbook, then use it in a short spoken conversation and see
          whether you actually did, with your own words quoted back to you.
        </p>
        <BlobSays who="sunny" size={60}>
          {user ? `Hi ${user.name}! ` : 'Hi! '}We're the Blobs. Each of us looks after one speaking skill, and we take turns teaching.
        </BlobSays>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          [BookOpen, 'Read', 'Short illustrated chapters written from CC-licensed college textbooks, with citations.', 'bg-read-soft!'],
          [MessageCircle, 'Talk', 'A conversation partner (an interviewer, a professor, a customer) who makes you use the technique.', 'bg-talk-soft!'],
          [Sparkles, 'Grow', 'Feedback that quotes what you said, one fix, a retry, and your before-and-after numbers.', 'bg-leaf-soft!'],
        ].map(([Icon, t, d, bg]) => {
          const I = Icon as typeof BookOpen
          return (
            <div key={t as string} className={`card ${bg as string}`}>
              <I size={22} aria-hidden />
              <p className="mt-2 font-heading text-xl font-bold">{t as string}</p>
              <p className="text-muted">{d as string}</p>
            </div>
          )
        })}
      </section>

      <section id="squad" className="flex flex-col gap-3">
        <h2 className="text-3xl font-bold">Meet the Blob squad</h2>
        <p className="text-muted">One colour, one speaking skill. When a chapter is about a skill, that Blob teaches it.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SQUAD.map((b) => (
            <article key={b.id} className="card flex flex-col items-center gap-1 p-3 text-center">
              <Blob who={b.id} size={92} label={`${b.name}, the ${b.skill.toLowerCase()} Blob`} />
              <h3 className="font-heading text-xl font-bold">{b.name}</h3>
              <p className="label">{b.skill}</p>
              <p className="text-[0.95rem] leading-snug">{b.line}</p>
              <p className="label mt-auto pt-1 text-muted">Teaches: {b.teaches}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold">Made with open tools</h2>
        <p className="mt-1 text-muted">
          Gemma writes the chapters and plays your conversation partner. Whisper (or ElevenLabs) listens, Kokoro (or
          ElevenLabs) speaks. Lessons come from <i>Stand up, Speak out</i> and <i>Exploring Public Speaking</i>
          (CC BY-NC-SA), and the “New here” track from Wikipedia and Wiktionary (CC BY-SA). In local mode, nothing you
          say leaves your computer.
        </p>
        <Link to="/sources" className="mt-3 flex items-center gap-2 font-bold underline">
          <Shield size={18} /> Sources & privacy <ChevronRight size={16} />
        </Link>
      </section>
    </div>
  )
}
