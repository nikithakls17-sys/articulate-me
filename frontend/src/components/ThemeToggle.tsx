import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} className="grid h-9 w-9 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_var(--ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
