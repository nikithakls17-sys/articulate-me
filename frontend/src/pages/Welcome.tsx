import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, WORLD_LABELS, type World } from '../api'
import { useSession } from '../session'

const GOALS = ['Stop rambling', 'Sound more confident', 'Fewer "um"s', 'Nail an upcoming event']

export default function Welcome() {
  const { signIn } = useSession()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [world, setWorld] = useState<World | null>(null)
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finish = async () => {
    if (!world) return
    setBusy(true)
    try {
      const u = await api.createUser(name || 'friend', world, goal)
      signIn(u.id)
      nav('/day/0')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[85vh] flex-col">
      {step === 0 && (
        <div className="flex flex-1 flex-col justify-center gap-6 text-center">
          <div className="text-7xl" aria-hidden>🎙️</div>
          <h1 className="text-4xl font-black leading-tight">I Talk,<br />You Listen</h1>
          <p className="text-lg text-muted">
            Everyone says “get to the point.” Nobody teaches how. Five minutes a day: learn one real technique,
            say it out loud, and find out if you actually used it.
          </p>
          <label className="text-left font-extrabold">
            What should I call you?
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your first name"
              className="mt-2 w-full rounded-2xl border-2 border-line bg-white px-4 py-4 text-lg font-bold outline-none focus:border-coral" />
          </label>
          <button className="btn-primary" onClick={() => setStep(1)}>Let's go</button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-black">Where do you talk the most?</h2>
          <p className="text-muted">Every example and drill will come from this world. You can change it later.</p>
          {(Object.keys(WORLD_LABELS) as World[]).map((w) => (
            <button key={w} onClick={() => setWorld(w)}
              className={`card flex items-center gap-4 text-left transition ${world === w ? 'border-coral bg-orange-50' : ''}`}>
              <span className="text-4xl" aria-hidden>{WORLD_LABELS[w].emoji}</span>
              <span>
                <span className="block text-lg font-extrabold">{WORLD_LABELS[w].label}</span>
                <span className="text-sm text-muted">{WORLD_LABELS[w].blurb}</span>
              </span>
            </button>
          ))}
          <button className="btn-primary mt-2" disabled={!world} onClick={() => setStep(2)}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-black">What do you want most?</h2>
          {GOALS.map((g) => (
            <button key={g} onClick={() => setGoal(g)}
              className={`card text-left text-lg font-extrabold ${goal === g ? 'border-coral bg-orange-50' : ''}`}>{g}</button>
          ))}
          <div className="card bg-leaf-soft border-leaf/30 text-sm">
            <b>First up: your Day 0 baseline.</b> Introduce yourself for up to 60 seconds. No lesson, no pressure.
            It's the “before” picture we'll compare you against.
          </div>
          {error && <p className="font-bold text-coral-dark">{error}</p>}
          <button className="btn-primary" disabled={busy} onClick={finish}>{busy ? 'Setting up…' : 'Record my baseline'}</button>
        </div>
      )}
    </div>
  )
}
