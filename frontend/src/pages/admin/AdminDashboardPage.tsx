import React, { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import {
  Users,
  HardDrive,
  Activity,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { adminApi } from '../../lib/api'
import { AdminDashboard } from '../../types'

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getDashboard()
      setData(res.data)
    } catch (err) {
      console.error('Failed to load admin dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-gray-400 animate-pulse-soft">
        Aggregating live platform metrics...
      </div>
    )
  }

  const successRate =
    data && data.total_analysis_runs > 0
      ? Math.round((data.successful_runs / data.total_analysis_runs) * 100)
      : 100

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2A3D6A]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Platform Overview</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time platform metrics computed directly from database records.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-3.5 py-1.5 rounded-xl bg-[#2A3D6A] hover:bg-[#39528D] text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Users</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{data?.total_users ?? 0}</span>
            <span className="text-[10px] text-gray-400">{data?.active_users_7d ?? 0} active (7d)</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Datasets</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{data?.total_datasets ?? 0}</span>
            <span className="text-[10px] text-gray-400">{Math.round((data?.total_storage_bytes ?? 0) / 1024)} KB stored</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Analysis Jobs</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{data?.total_analysis_runs ?? 0}</span>
            <span className="text-[10px] text-green-400 font-semibold">{successRate}% success rate</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Failed Jobs</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{data?.failed_runs ?? 0}</span>
            <span className="text-[10px] text-gray-400">Preserved without data corruption</span>
          </div>
        </div>
      </div>

      {/* Chart: Operational Activity Distribution */}
      <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#9AB7FF]" />
          <span>Platform Execution Ratio</span>
        </h3>
        <div className="h-[280px] w-full flex items-center justify-center">
          <Plot
            data={[
              {
                type: 'pie',
                labels: ['Successful Jobs', 'Failed Jobs'],
                values: [data?.successful_runs || 1, data?.failed_runs || 0],
                marker: { colors: ['#648B68', '#C76F91'] },
                hole: 0.5,
                textinfo: 'label+percent',
              },
            ]}
            layout={{
              autosize: true,
              margin: { l: 20, r: 20, t: 20, b: 20 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#F3F6FF', family: 'Inter, sans-serif' },
              showlegend: true,
            }}
            useResizeHandler
            style={{ width: '100%', height: '260px' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>
      </div>

      {/* Recent Platform Runs Table */}
      <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#9AB7FF]" />
          <span>Recent Platform Activity</span>
        </h3>

        {!data?.recent_runs || data.recent_runs.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No recent activity recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A3D6A] text-gray-400">
                  <th className="py-2.5 px-3">Run ID</th>
                  <th className="py-2.5 px-3">Prompt</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A3D6A]/60">
                {data.recent_runs.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#9AB7FF]">{r.id.slice(0, 8)}</td>
                    <td className="py-2.5 px-3 truncate max-w-xs">{r.original_prompt || 'N/A'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'completed'
                            ? 'bg-green-950 text-green-300'
                            : 'bg-red-950 text-red-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
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

