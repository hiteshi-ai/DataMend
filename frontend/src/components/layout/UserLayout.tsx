import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  HelpCircle,
  LayoutDashboard,
  FlaskConical,
  LineChart,
  FileSpreadsheet,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { ThemeSelector } from '../ui/ThemeSelector'
import { LanguageSelector } from '../ui/LanguageSelector'

export const UserLayout: React.FC = () => {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/how-to-use', label: t('nav.howToUse', 'How to Use'), icon: HelpCircle },
    { to: '/workspace', label: t('nav.workspace', 'My Workspace'), icon: LayoutDashboard },
    { to: '/data-lab', label: t('nav.dataLab', 'Data Lab'), icon: FlaskConical },
    { to: '/insights', label: t('nav.insights', 'Insights & Compare'), icon: LineChart },
    { to: '/reports', label: t('nav.reports', 'Reports & Export'), icon: FileSpreadsheet },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200/40 bg-white/60 dark:bg-black/20 backdrop-blur-md p-5 justify-between shrink-0 shadow-sm">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-[var(--color-accent)] to-purple-600 bg-clip-text text-transparent">
                DataMend
              </span>
              <p className="text-[10px] text-gray-500 font-medium">Prompt-Driven Data Lab</p>
            </div>
          </div>

          {/* Navigation - EXACTLY 5 PRIMARY SECTIONS */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-white shadow-sm font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-gray-200/40 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center font-bold text-xs uppercase">
              {user?.display_name ? user.display_name[0] : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">{user?.display_name || user?.email || 'User'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header */}
        <header className="h-16 px-6 border-b border-gray-200/40 bg-white/40 dark:bg-black/10 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight text-sm">DataMend</span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs font-medium text-gray-400">
              Reliable, prompt-driven data cleaning & transparency
            </span>
          </div>

          {/* Controls: Theme & Language */}
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <ThemeSelector />
          </div>
        </header>

        {/* Outlet for Pages */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation (Exactly 5 items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-black/90 backdrop-blur-lg border-t border-gray-200/50 flex items-center justify-around px-2 z-30 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[var(--color-accent)] font-bold' : 'text-gray-500'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
