import { Briefcase, Clapperboard, Coffee, GraduationCap, Handshake, type LucideIcon } from 'lucide-react'
import type { World } from './api'

export const WORLD_ICONS: Record<World, LucideIcon> = {
  student: GraduationCap,
  job_seeker: Briefcase,
  customer_facing: Handshake,
  creator: Clapperboard,
  everyday: Coffee,
}

/** App mark: a speech bubble with sound waves, drawn inline so it works offline and in both themes. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--color-coral)" />
      <path d="M16 20h32a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H30l-8 7v-7h-6a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M25 28v6M32 25v12M39 28v6" stroke="var(--color-coral)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
