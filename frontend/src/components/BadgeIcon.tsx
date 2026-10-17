import { Award, BookOpen, Flag, Flame, Lock, MessageCircle, NotebookPen, Sparkles, Star, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  first_chapter: BookOpen,
  baseline: Flag,
  first_convo: MessageCircle,
  prep_in_convo: Star,
  low_fillers: Wind,
  streak_3: Flame,
  perfect_quiz: Sparkles,
  note_taker: NotebookPen,
  week_1: Award,
}

export default function BadgeIcon({ id, earned = true, size = 56 }: { id: string; earned?: boolean; size?: number }) {
  const Icon = earned ? ICONS[id] ?? Award : Lock
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl border-2 ${earned ? 'border-sun bg-amber-50 text-coral' : 'border-line bg-cream text-muted'}`}
      style={{ width: size, height: size }}>
      <Icon size={size * 0.48} strokeWidth={2.2} aria-hidden />
    </span>
  )
}
