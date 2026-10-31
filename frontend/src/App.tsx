import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './i18n'
import { useAuthStore } from './store/authStore'
import { useThemeStore, THEMES } from './store/themeStore'

// Layouts
import { UserLayout } from './components/layout/UserLayout'
import { AdminLayout } from './components/layout/AdminLayout'

// User Portal Pages (5 Primary Sections)
import { HowToUsePage } from './pages/HowToUsePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { DataLabPage } from './pages/DataLabPage'
import { InsightsPage } from './pages/InsightsPage'
import { ReportsPage } from './pages/ReportsPage'

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'

// Admin Portal Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminRunsPage } from './pages/admin/AdminRunsPage'
import { AdminStoragePage } from './pages/admin/AdminStoragePage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminAuditPage } from './pages/admin/AdminAuditPage'

export const App: React.FC = () => {
  const { token, user } = useAuthStore()
  const { themeKey, setTheme } = useThemeStore()

  // Apply theme and sync user preference
  useEffect(() => {
    if (user?.theme && user.theme !== themeKey && THEMES[user.theme]) {
      setTheme(user.theme)
    } else {
      setTheme(themeKey)
    }
  }, [user?.theme])

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/workspace" replace />} />
        <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/workspace" replace />} />

        {/* Portal A: User Portal (Exactly 5 Primary Sections) */}
        <Route path="/" element={<UserLayout />}>
          <Route index element={<Navigate to="/workspace" replace />} />
          <Route path="how-to-use" element={<HowToUsePage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="data-lab" element={<DataLabPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        {/* Portal B: Admin Portal */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="runs" element={<AdminRunsPage />} />
          <Route path="storage" element={<AdminStoragePage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
