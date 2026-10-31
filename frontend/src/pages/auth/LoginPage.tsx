import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react'
import { authApi } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { LanguageSelector } from '../../components/ui/LanguageSelector'
import { ThemeSelector } from '../../components/ui/ThemeSelector'

export const LoginPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await authApi.login({ email, password })
      const { access_token, user } = res.data
      setToken(access_token)
      setUser(user)
      navigate('/workspace')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[var(--color-bg)] text-[var(--color-text)] p-4 transition-colors">
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <LanguageSelector />
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-gray-200/50 shadow-xl p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center text-white mb-3 shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">DataMend</h1>
          <p className="text-xs text-gray-500 mt-1">Prompt-driven data cleaning & transparency</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">{t('auth.email', 'Email Address')}</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">{t('auth.password', 'Password')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{t('auth.signIn', 'Sign In')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-200/50 flex flex-col items-center gap-3 text-xs text-gray-500">
          <p>
            {t('auth.noAccount', "Don't have an account?")}{' '}
            <Link to="/register" className="text-[var(--color-accent)] font-semibold hover:underline">
              {t('auth.signUp', 'Create Account')}
            </Link>
          </p>
          <Link to="/admin/login" className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            Admin Portal Access →
          </Link>
        </div>
      </div>
    </div>
  )
}
