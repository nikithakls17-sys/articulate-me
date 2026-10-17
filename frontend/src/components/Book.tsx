import { useEffect, useRef, useState, type ReactNode } from 'react'

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

interface BookProps {
  faces: ReactNode[]          // the pages, in reading order
  coverLeft: ReactNode        // spread mode: the inside cover shown left of page 1
  end: ReactNode              // what lies under the last page (end of chapter)
  spread: boolean             // two-page spread (laptop) or single page (phone/tablet)
  position: number            // number of leaves turned
  onPosition: (n: number) => void
  height: string              // CSS height of one page
}

/** A 3D page-turn book. Each leaf has a front and a back and rotates on the spine (rotateY -180deg).
 *  Spread: leaf k = faces[2k] (front, right page) / faces[2k+1] (back, left page once turned).
 *  Single: leaf k = faces[k], its back is plain paper and it fades out once turned. */
export default function Book({ faces, coverLeft, end, spread, position, onPosition, height }: BookProps) {
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const leaves = spread ? Math.ceil(faces.length / 2) : faces.length
  const [turning, setTurning] = useState<number | null>(null)
  const touchX = useRef<number | null>(null)
  const prevPos = useRef(position)

  useEffect(() => {
    if (prevPos.current === position) return
    // the leaf in motion must ride above both stacks while it turns
    setTurning(position > prevPos.current ? position - 1 : position)
    prevPos.current = position
    const t = window.setTimeout(() => setTurning(null), 800)
    return () => window.clearTimeout(t)
  }, [position])

  const go = (n: number) => onPosition(Math.max(0, Math.min(leaves, n)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') go(position + 1)
      if (e.key === 'ArrowLeft') go(position - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return
      const dx = e.changedTouches[0].clientX - touchX.current
      touchX.current = null
      if (window.getSelection()?.toString()) return // selecting text to highlight, not swiping
      if (Math.abs(dx) > 60) go(position + (dx < 0 ? 1 : -1))
    },
  }

  // a page is ~0.74 as wide as it is tall; a spread is two pages, capped by the space available
  const style = { height, width: spread ? `min(calc(${height} * 1.48), 100%)` : '100%' }

  if (reduced) {
    // no 3D: show the visible page(s) and cross-fade
    const left = spread ? (position === 0 ? coverLeft : faces[2 * position - 1] ?? <Blank />) : null
    const right = spread ? (faces[2 * position] ?? end) : (faces[position] ?? end)
    return (
      <div className={`mx-auto flex ${spread ? 'spread' : 'single'}`} style={style} {...swipe}>
        {spread && <div key={`l${position}`} className="face fade-in relative" style={{ width: '50%' }}>{left}</div>}
        <div key={`r${position}`} className="face fade-in relative" style={{ width: spread ? '50%' : '100%' }}>{right}</div>
      </div>
    )
  }

  return (
    <div className={`book mx-auto ${spread ? 'spread' : 'single'}`} style={style} {...swipe} role="region" aria-label="Chapter pages">
      {spread && <div className="face" style={{ right: '50%', boxShadow: 'var(--shadow-lg)' }}>{coverLeft}</div>}
      <div className="face" style={spread ? { left: '50%', boxShadow: 'var(--shadow-lg)' } : { boxShadow: 'var(--shadow-lg)' }}>{end}</div>

      {Array.from({ length: leaves }, (_, k) => {
        const flipped = k < position
        const z = turning === k ? leaves + 10 : flipped ? k + 1 : leaves - k + 1
        const front = spread ? faces[2 * k] : faces[k]
        const back = spread ? faces[2 * k + 1] ?? <Blank /> : <Blank />
        const visible = k === position || k === position - 1 || turning === k
        return (
          <div key={k} className={`leaf ${flipped ? 'flipped' : ''}`} aria-hidden={!visible}
            style={{ zIndex: z, left: spread ? '50%' : 0, width: spread ? '50%' : '100%' }}>
            <div className="face front">
              {visible || Math.abs(k - position) < 2 ? front : null}
              {k === position && <button className="corner right" aria-label="Next page" onClick={() => go(position + 1)} />}
              {!spread && k === position && position > 0 && (
                <button className="corner left" aria-label="Previous page" onClick={() => go(position - 1)} />
              )}
            </div>
            <div className="face back">
              {spread && (visible || Math.abs(k - position) < 2) ? back : null}
              {spread && k === position - 1 && <button className="corner left" aria-label="Previous page" onClick={() => go(position - 1)} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Blank() {
  // lined paper for the back of a page
  return <div className="h-full w-full" style={{ backgroundImage: 'repeating-linear-gradient(var(--surface) 0 27px, var(--grid-line) 27px 28px)' }} />
}
