import React from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'hi' : 'en'
    i18n.changeLanguage(nextLang)
    localStorage.setItem('datamend_lang', nextLang)
    document.documentElement.lang = nextLang
    if (nextLang === 'hi') {
      document.body.classList.add('lang-hi')
    } else {
      document.body.classList.remove('lang-hi')
    }
  }

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-white/70 dark:bg-black/20 border border-gray-200/50 hover:bg-white transition-all shadow-sm"
      title="Switch Language / भाषा बदलें"
    >
      <Languages className="w-3.5 h-3.5 text-gray-500" />
      <span>{i18n.language === 'en' ? 'हिन्दी' : 'English'}</span>
    </button>
  )
}
