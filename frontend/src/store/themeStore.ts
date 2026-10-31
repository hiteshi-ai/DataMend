import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeKey, Theme } from '../types'

export const THEMES: Record<ThemeKey, Theme> = {
  lavender: { bg: '#F4F0FF', accent: '#8B79C6', text: '#29243B', name: 'Lavender Mist' },
  blush:    { bg: '#FFF1F5', accent: '#C76F91', text: '#432C36', name: 'Blush Pink' },
  sage:     { bg: '#F1F7F0', accent: '#648B68', text: '#26382B', name: 'Sage Green' },
  midnight: { bg: '#101B35', accent: '#9AB7FF', text: '#F3F6FF', name: 'Midnight Navy' },
}

function applyThemeToRoot(key: ThemeKey) {
  const t = THEMES[key]
  const root = document.documentElement
  root.style.setProperty('--color-bg', t.bg)
  root.style.setProperty('--color-accent', t.accent)
  root.style.setProperty('--color-text', t.text)
  root.setAttribute('data-theme', key)
}

interface ThemeState {
  themeKey: ThemeKey
  theme: Theme
  setTheme: (key: ThemeKey) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeKey: 'lavender',
      theme: THEMES.lavender,
      setTheme: (key: ThemeKey) => {
        applyThemeToRoot(key)
        set({ themeKey: key, theme: THEMES[key] })
      },
    }),
    {
      name: 'datamend_theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToRoot(state.themeKey)
        }
      },
    }
  )
)
