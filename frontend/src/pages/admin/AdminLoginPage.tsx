import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldAlert, Lock, User, AlertCircle, ArrowRight, KeyRound } from 'lucide-react'
import { authApi } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { LanguageSelector } from '../../components/ui/LanguageSelector'

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    try {
      const res = await authApi.adminLogin({ username, password })
      const { access_token, user, requires_password_change } = res.data

      setToken(access_token)
      setUser(user)

      if (requires_password_change || user.first_login) {
        setNeedsPasswordChange(true)
        setInfo('First login detected: Please set a strong, permanent admin password.')
      } else {
        navigate('/admin')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid administrator credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError('Admin password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      await authApi.adminChangePassword({
        current_password: password,
        new_password: newPassword,
      })
      navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update admin password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#101B35] text-[#F3F6FF] p-4">
      <div className="absolute top-6 right-6">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md bg-[#162244] border border-[#2A3D6A] rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white mb-3 shadow-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">DataMend Admin Portal</h1>
          <p className="text-xs text-red-400 mt-1 font-semibold uppercase tracking-wider">
            Restricted System Access
          </p>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
          ⚠️ <b>Security Notice:</b> Only accounts with verified server-side admin roles may access this console. All attempts are recorded in tamper-evident audit logs.
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="mb-4 p-3 rounded-xl bg-blue-950/50 border border-blue-800/80 text-blue-200 text-xs">
            {info}
          </div>
        )}

        {!needsPasswordChange ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-300">Admin Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AB7FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AB7FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* First Login Password Change Form */
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="p-3 bg-red-950/20 border border-red-800/40 rounded-xl text-xs text-red-200">
              <KeyRound className="w-4 h-4 inline mr-1 text-red-400" />
              Initial credentials (`admin@123`) must be changed immediately before proceeding.
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-300">New Admin Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AB7FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-300">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2.5 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9AB7FF]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#9AB7FF] text-[#101B35] font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              Set Permanent Password & Enter
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-[#2A3D6A] text-center text-xs text-gray-400">
          <Link to="/login" className="hover:text-gray-200">
            ← Return to Standard User Portal
          </Link>
        </div>
      </div>
    </div>
  )
}

