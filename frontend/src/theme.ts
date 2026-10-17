import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'articulate.theme'

function stored(): Theme | null {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null } catch { return null }
}
const system = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** Apply the saved theme before React renders, so there's no flash of the wrong theme. */
export function applyStoredTheme() {
  const t = stored()
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
}

/** Follows the system until the learner picks one with the toggle. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => stored() ?? system())
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => { if (!stored()) setThemeState(system()) }
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  const setTheme = (t: Theme) => {
    try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
    document.documentElement.dataset.theme = t
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#1a1917' : '#ebe8e2')
    setThemeState(t)
  }
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
