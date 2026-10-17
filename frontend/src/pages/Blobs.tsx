import { Link } from 'react-router-dom'
import Blob, { type Accessory, type Mood } from '../components/Blob'

const MOODS: { mood: Mood; accessory: Accessory; label: string }[] = [
  { mood: 'happy', accessory: 'none', label: 'Happy to see you' },
  { mood: 'calm', accessory: 'specs', label: 'Teaching' },
  { mood: 'excited', accessory: 'none', label: 'You did it' },
  { mood: 'proud', accessory: 'cap', label: 'Chapter complete' },
  { mood: 'thinking', accessory: 'none', label: 'Grading' },
  { mood: 'listening', accessory: 'headphones', label: 'Listening' },
  { mood: 'nervous', accessory: 'none', label: 'Tough question' },
  { mood: 'calm', accessory: 'coffee', label: 'Morning' },
  { mood: 'sleepy', accessory: 'nightcap', label: 'Late night' },
]

/** "Meet Blob": every mood and accessory on one sheet. */
export default function Blobs() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="label text-talk">Mascot</p>
        <h1 className="text-4xl font-bold">Meet Blob</h1>
        <p className="mt-1 text-lg text-muted">A small fuzzy coach. Blob's colour shows its mood and the eyes do the talking.</p>
      </header>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-3">
        {MOODS.map((m) => (
          <div key={m.label} className="card flex flex-col items-center gap-1 p-3 text-center">
            <Blob mood={m.mood} accessory={m.accessory} size={96} />
            <p className="label">{m.mood}</p>
            <p className="text-sm text-muted">{m.label}</p>
          </div>
        ))}
      </div>
      <Link to="/" className="btn-ghost self-start">Back</Link>
    </div>
  )
}
