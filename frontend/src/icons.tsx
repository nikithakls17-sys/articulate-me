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
      <rect x="2" y="2" width="60" height="60" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M14 18h36v24H30l-8 8v-8h-8z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="miter" />
      <path d="M25 27v6M32 24v12M39 27v6" stroke="var(--ink)" strokeWidth="4" strokeLinecap="square" />
    </svg>
  )
}
