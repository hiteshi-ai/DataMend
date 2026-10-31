import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Ban,
  CheckCircle,
} from 'lucide-react'
import { adminApi } from '../../lib/api'
import { AdminUser } from '../../types'

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSuspended, setFilterSuspended] = useState<string>('')
  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteTokenInput, setDeleteTokenInput] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers({
        search: search || undefined,
        suspended: filterSuspended === 'suspended' ? true : filterSuspended === 'active' ? false : undefined,
      })
      setUsers(res.data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [filterSuspended])

  const handleSuspend = async (userId: string) => {
    try {
      await adminApi.suspendUser(userId)
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to suspend user.')
    }
  }

  const handleReactivate = async (userId: string) => {
    try {
      await adminApi.reactivateUser(userId)
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reactivate user.')
    }
  }

  const handleDelete = async (userId: string) => {
    if (deleteTokenInput !== 'CONFIRM_DELETE') {
      alert("Please enter exactly 'CONFIRM_DELETE' to authorize account removal.")
      return
    }
    try {
      await adminApi.deleteUser(userId, 'CONFIRM_DELETE')
      setConfirmDeleteId(null)
      setDeleteTokenInput('')
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete user.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A3D6A]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">User Account Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Audit registered accounts, oversee data retention, and configure suspension policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              placeholder="Search user..."
              className="pl-9 pr-3 py-2 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-xs text-white focus:outline-none"
            />
          </div>

          <select
            value={filterSuspended}
            onChange={(e) => setFilterSuspended(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-xs text-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
        {loading ? (
          <p className="text-xs text-gray-400 py-8 text-center animate-pulse-soft">Loading user records...</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">No matching accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A3D6A] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Datasets</th>
                  <th className="py-3 px-3">Runs</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Registered</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A3D6A]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{u.display_name || 'Anonymous User'}</div>
                      <div className="text-[10px] text-gray-400">{u.email || u.id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'admin' ? 'bg-red-950 text-red-300' : 'bg-gray-800 text-gray-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-300">{u.dataset_count ?? 0}</td>
                    <td className="py-3 px-3 font-semibold text-gray-300">{u.run_count ?? 0}</td>
                    <td className="py-3 px-3">
                      {u.is_suspended ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-950 text-green-300">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-400">{new Date(u.created_at || '').toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-right">
                      {u.role !== 'admin' && (
                        <div className="flex items-center justify-end gap-2">
                          {u.is_suspended ? (
                            <button
                              onClick={() => handleReactivate(u.id)}
                              className="px-2 py-1 rounded bg-green-900/50 hover:bg-green-800 text-[10px] font-bold text-green-300 transition-colors"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspend(u.id)}
                              className="px-2 py-1 rounded bg-amber-900/50 hover:bg-amber-800 text-[10px] font-bold text-amber-300 transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteId(u.id)}
                            className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                            title="Delete Account & Retained Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#162244] border border-[#2A3D6A] text-white p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Permanent Account Deletion</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This action will permanently delete the user's account, profile, private datasets, storage versions, and reports. Type <b>CONFIRM_DELETE</b> below to proceed.
            </p>
            <input
              type="text"
              value={deleteTokenInput}
              onChange={(e) => setDeleteTokenInput(e.target.value)}
              placeholder="CONFIRM_DELETE"
              className="w-full px-3 py-2 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setConfirmDeleteId(null)
                  setDeleteTokenInput('')
                }}
                className="px-3 py-1.5 rounded-lg border border-[#2A3D6A] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleteTokenInput !== 'CONFIRM_DELETE'}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white disabled:opacity-40 transition-colors"
              >
                Permanently Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
