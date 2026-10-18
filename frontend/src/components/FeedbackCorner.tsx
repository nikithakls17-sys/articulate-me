import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, type FeedbackForm, type PayAnswer } from '../api'
import { useSession } from '../session'

const PAY: { id: PayAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes' }, { id: 'maybe', label: 'Maybe' }, { id: 'no', label: 'No' },
]

const field = 'mt-1 w-full border-2 border-ink bg-cream p-2 font-serif text-base normal-case tracking-normal text-ink outline-none focus:bg-white'

/** Feedback corner: a short, optional card after a chapter or a conversation, and on /feedback. Anonymous. */
export default function FeedbackCorner({ context, day, onClose }:
  { context: FeedbackForm['context']; day?: number | null; onClose?: () => void }) {
  const { user } = useSession()
  const [f, setF] = useState<FeedbackForm>({ context, day, rating: null, pay: null, want_next: '', confusing: '', first_name: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const empty = f.rating === null && f.pay === null && !f.want_next.trim() && !f.confusing.trim()

  const submit = async () => {
    setState('sending'); setError('')
    try {
      await api.sendFeedback(user?.id, f)
      setState('sent')
    } catch (e) {
      setError((e as Error).message); setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <aside className="card flex items-center gap-3 bg-check-soft!" aria-live="polite">
        <Check className="shrink-0" size={22} strokeWidth={3} />
        <p className="flex-1">Thank you{f.first_name.trim() ? `, ${f.first_name.trim()}` : ''}. That helps a lot.</p>
        {onClose && <button className="label underline" onClick={onClose}>Close</button>}
      </aside>
    )
  }

  return (
    <aside className="card flex flex-col gap-4 bg-check-soft!" aria-labelledby="fb-title">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
        <div>
          <p className="label">Feedback corner · optional</p>
          <h2 id="fb-title" className="text-2xl font-bold">How was that?</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="border-2 border-ink bg-white p-1" aria-label="Skip feedback"><X size={18} /></button>
        )}
      </div>

      <fieldset>
        <legend className="font-bold">How useful was this?</legend>
        <div className="mt-2 grid grid-cols-5 border-2 border-ink" role="radiogroup" aria-label="Usefulness, 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={f.rating === n} aria-label={`${n} of 5`}
              onClick={() => setF({ ...f, rating: f.rating === n ? null : n })}
              className={`label py-2.5 text-base ${n > 1 ? 'border-l-2 border-ink' : ''} ${f.rating === n ? 'bg-ink text-white' : 'bg-white'}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="label mt-1 flex justify-between text-muted"><span>Not useful</span><span>Very useful</span></p>
      </fieldset>

      <fieldset>
        <legend className="font-bold">Would you pay $5/month for this?</legend>
        <div className="mt-2 grid grid-cols-3 border-2 border-ink" role="radiogroup" aria-label="Would you pay 5 dollars a month">
          {PAY.map((p, i) => (
            <button key={p.id} role="radio" aria-checked={f.pay === p.id} onClick={() => setF({ ...f, pay: f.pay === p.id ? null : p.id })}
              className={`label py-2.5 ${i ? 'border-l-2 border-ink' : ''} ${f.pay === p.id ? 'bg-ink text-white' : 'bg-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="font-bold">
        What would you want next?
        <textarea rows={2} maxLength={500} value={f.want_next} onChange={(e) => setF({ ...f, want_next: e.target.value })}
          placeholder="A lesson, a feature, a kind of conversation…" className={field} />
      </label>
      <label className="font-bold">
        Anything confusing or broken?
        <textarea rows={2} maxLength={500} value={f.confusing} onChange={(e) => setF({ ...f, confusing: e.target.value })}
          placeholder="What happened, and where?" className={field} />
      </label>
      <label className="font-bold">
        First name <span className="label text-muted">optional</span>
        <input maxLength={40} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })}
          autoComplete="off" className={field} />
      </label>

      <p className="text-sm italic text-muted">
        Stored anonymously: your answers, your world and lesson, and your before and after numbers. Never your audio or what you said.
      </p>
      {error && <p className="label text-coral-dark" role="alert">{error}</p>}
      <button className="btn-primary" disabled={empty || state === 'sending'} onClick={submit}>
        {state === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </aside>
  )
}
