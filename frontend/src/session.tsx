import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type User } from './api'

const KEY = 'articulate.user_id'

const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (id: string | null) => {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY) } catch { /* private mode */ }
}

interface Session { user: User | null; loading: boolean; refresh: () => Promise<void>; signIn: (id: string) => void; signOut: () => void }
const Ctx = createContext<Session>(null as unknown as Session)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(read)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!id)

  const refresh = useCallback(async () => {
    if (!id) { setUser(null); setLoading(false); return }
    try {
      setUser(await api.user(id))
    } catch {
      write(null)
      setId(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const signIn = (newId: string) => { write(newId); setLoading(true); setId(newId) }
  const signOut = () => { write(null); setId(null); setUser(null) }

  return <Ctx.Provider value={{ user, loading, refresh, signIn, signOut }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
