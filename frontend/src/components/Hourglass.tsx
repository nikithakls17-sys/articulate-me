/** Hourglass whose sand drains from top to bottom as `progress` goes 0 → 1. Square, ink-stroked, no gradients. */
export default function Hourglass({ progress, size = 28 }: { progress: number; size?: number }) {
  const p = Math.max(0, Math.min(1, progress))
  // bulb interiors: top spans y 6..22, bottom spans y 26..42 (viewBox 32x48)
  const topH = 15 * (1 - p)
  const botH = 15 * p
  return (
    <svg width={size * (32 / 48)} height={size} viewBox="0 0 32 48" aria-hidden>
      <defs>
        <clipPath id="hg-top"><path d="M7 6h18v4l-9 12-9-12z" /></clipPath>
        <clipPath id="hg-bot"><path d="M16 26l9 12v4H7v-4z" /></clipPath>
      </defs>
      <rect x="7" y={22 - topH} width="18" height={topH} fill="var(--highlight)" clipPath="url(#hg-top)" />
      <rect x="7" y={42 - botH} width="18" height={botH} fill="var(--highlight)" clipPath="url(#hg-bot)" />
      {p > 0 && p < 1 && <line x1="16" y1="22" x2="16" y2={42 - botH} stroke="var(--accent-deep)" strokeWidth="1.5" />}
      <path d="M7 6h18v4l-9 12 9 12v8H7v-8l9-12-9-12z" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="miter" />
      <rect x="3" y="2" width="26" height="4" fill="var(--ink)" />
      <rect x="3" y="42" width="26" height="4" fill="var(--ink)" />
    </svg>
  )
}
