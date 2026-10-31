import React, { useState, useEffect } from 'react'
import { FileText, Shield, Clock, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { adminApi } from '../../lib/api'
import { AdminAuditLog } from '../../types'

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAuditLogs({
        action_type: actionFilter || undefined,
        limit: 100,
      })
      setLogs(res.data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [actionFilter])

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A3D6A]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Privileged Audit Log</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Tamper-evident record of administrative operations, security events, and policy modifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-xs text-white focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="admin_login">Admin Logins</option>
            <option value="suspend_user">User Suspensions</option>
            <option value="reactivate_user">User Reactivations</option>
            <option value="delete_user">Account Deletions</option>
            <option value="update_settings">Settings Updates</option>
          </select>

          <button
            onClick={loadLogs}
            className="px-3.5 py-1.5 rounded-xl bg-[#2A3D6A] hover:bg-[#39528D] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
        {loading ? (
          <p className="text-xs text-gray-400 py-8 text-center animate-pulse-soft">Loading audit records...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">No audit logs recorded for selected criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A3D6A] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Admin ID</th>
                  <th className="py-2.5 px-3">Target Resource</th>
                  <th className="py-2.5 px-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A3D6A]/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors font-mono text-[11px]">
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2A3D6A] text-[#9AB7FF]">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">{log.admin_id?.slice(0, 8) || 'System'}</td>
                    <td className="py-2.5 px-3 text-gray-300">{log.target_resource || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-400 max-w-xs truncate">
                      {JSON.stringify(log.metadata || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

