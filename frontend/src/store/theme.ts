import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  dark: boolean
  toggle: () => void
  apply: () => void
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
      toggle: () => {
        set({ dark: !get().dark })
        get().apply()
      },
      apply: () => {
        const dark = get().dark
        document.documentElement.classList.toggle('dark', dark)
      },
    }),
    { name: 'rds-theme' },
  ),
)
