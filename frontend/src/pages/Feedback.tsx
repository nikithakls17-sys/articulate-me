import { BlobSays } from '../components/Blob'
import FeedbackCorner from '../components/FeedbackCorner'
import { useSession } from '../session'

/** "Give feedback" from the menu, any time. */
export default function Feedback() {
  const { user } = useSession()
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="label text-muted">Feedback corner</p>
        <h1 className="text-4xl font-bold leading-tight">Tell us what you think</h1>
      </header>
      <BlobSays who="sunny" size={56}>
        {user ? `${user.name}, ` : ''}two minutes of your honest opinion shapes what we build next.
      </BlobSays>
      <FeedbackCorner context="menu" />
    </div>
  )
}
