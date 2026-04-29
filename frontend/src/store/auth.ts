import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/lib/types'

interface AuthState {
  access: string | null
  refresh: string | null
  user: User | null
  setSession: (s: { access: string; refresh: string; user: User }) => void
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User | null) => void
  logout: () => void
  isAdmin: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      access: null,
      refresh: null,
      user: null,
      setSession: ({ access, refresh, user }) => set({ access, refresh, user }),
      setTokens: (access, refresh) => set({ access, refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ access: null, refresh: null, user: null }),
      isAdmin: () => {
        const u = get().user
        return u?.is_admin === true || u?.role === 'admin'
      },
    }),
    { name: 'rds-auth' },
  ),
)

export const selectIsAdmin = (s: AuthState): boolean =>
  s.user?.is_admin === true || s.user?.role === 'admin'
