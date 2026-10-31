import React, { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ShieldAlert,
  Users,
  Activity,
  HardDrive,
  Settings,
  FileText,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { LanguageSelector } from '../ui/LanguageSelector'

export const AdminLayout: React.FC = () => {
  const { t } = useTranslation()
  const { user, isAdmin, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // If user is not admin, redirect to admin login
    if (!isAdmin) {
      navigate('/admin/login')
    }
  }, [isAdmin, navigate])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const adminNavItems = [
    { to: '/admin', label: 'Platform Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/runs', label: 'Processing & Runs', icon: Activity },
    { to: '/admin/storage', label: 'Storage & Data', icon: HardDrive },
    { to: '/admin/settings', label: 'System Settings', icon: Settings },
    { to: '/admin/audit', label: 'Audit Log', icon: FileText },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#101B35] text-[#F3F6FF]">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 border-r border-[#2A3D6A] bg-[#162244] p-5 flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Admin Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-[#2A3D6A] pb-4">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">DataMend</span>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Admin Portal</p>
            </div>
          </div>

          <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-800/40 rounded-lg text-[11px] text-red-200">
            ⚠️ Privileged Session
          </div>

          {/* Admin Nav Items */}
          <nav className="space-y-1.5">
            {adminNavItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                      isActive
                        ? 'bg-[#9AB7FF] text-[#101B35] font-bold shadow-md'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
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

        {/* Admin Footer & Logout */}
        <div className="pt-4 border-t border-[#2A3D6A] space-y-3">
          <div className="px-2">
            <p className="text-xs font-semibold text-gray-200">{user?.display_name || 'Administrator'}</p>
            <p className="text-[10px] text-gray-400">Role: {user?.role || 'admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Admin Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 border-b border-[#2A3D6A] bg-[#162244]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <span className="text-xs font-semibold tracking-wide text-gray-300">
            DataMend Operational Management System
          </span>
          <div className="flex items-center gap-3">
            <LanguageSelector />
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

