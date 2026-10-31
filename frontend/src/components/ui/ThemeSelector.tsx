import React from 'react'
import { Palette } from 'lucide-react'
import { useThemeStore, THEMES } from '../../store/themeStore'
import { ThemeKey } from '../../types'

export const ThemeSelector: React.FC = () => {
  const { themeKey, setTheme } = useThemeStore()

  return (
    <div className="relative inline-flex items-center gap-1.5 p-1 bg-white/70 dark:bg-black/20 rounded-full border border-gray-200/50 shadow-sm backdrop-blur-sm">
      <Palette className="w-3.5 h-3.5 ml-1 text-gray-500 opacity-70" />
      {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
        const t = THEMES[key]
        const isSelected = themeKey === key
        return (
          <button
            key={key}
            onClick={() => setTheme(key)}
            title={t.name}
            className={`w-5 h-5 rounded-full transition-all duration-200 ${
              isSelected
                ? 'ring-2 ring-offset-1 ring-gray-600 scale-110 shadow-sm'
                : 'opacity-70 hover:opacity-100 hover:scale-105'
            }`}
            style={{ backgroundColor: t.accent }}
            aria-label={`Switch to ${t.name} theme`}
          />
        )
      })}
    </div>
  )
}
