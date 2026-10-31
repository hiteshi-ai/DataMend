import React, { useState, useEffect } from 'react'
import { Activity, Clock, CheckCircle2, XCircle, Search, RefreshCw, FileText } from 'lucide-react'
import { adminApi } from '../../lib/api'
import { AnalysisRun } from '../../types'

export const AdminRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRun, setSelectedRun] = useState<any | null>(null)

  const loadRuns = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getRuns({
        status: statusFilter || undefined,
        limit: 50,
      })
      setRuns(res.data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [statusFilter])

  const inspectRun = async (runId: string) => {
    try {
      const res = await adminApi.getRun(runId)
      setSelectedRun(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A3D6A]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Analysis & Processing Monitoring</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time telemetry on transformation jobs, error messages, and execution durations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#2A3D6A] bg-[#101B35] text-xs text-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="failed">Failed Only</option>
            <option value="running">Running Only</option>
          </select>

          <button
            onClick={loadRuns}
            className="px-3 py-2 rounded-xl bg-[#2A3D6A] hover:bg-[#39528D] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runs List */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
          <h3 className="font-bold text-sm text-white">Analysis Executions ({runs.length})</h3>

          {loading ? (
            <p className="text-xs text-gray-400 py-8 text-center animate-pulse-soft">Loading analysis logs...</p>
          ) : runs.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No runs recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2A3D6A] text-gray-400 text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Run ID</th>
                    <th className="py-2.5 px-3">Prompt</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3D6A]/60">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#9AB7FF] text-[11px]">{r.id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 truncate max-w-xs">{r.original_prompt || 'Data cleaning'}</td>
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
                      <td className="py-2.5 px-3 text-gray-400">{new Date(r.created_at).toLocaleTimeString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => inspectRun(r.id)}
                          className="px-2.5 py-1 rounded bg-[#2A3D6A] hover:bg-[#39528D] text-[11px] font-semibold text-white"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Run Details Inspector */}
        <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#9AB7FF]" />
            <span>Operational Log Details</span>
          </h3>

          {selectedRun ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#101B35] border border-[#2A3D6A] space-y-1">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Run Identifier</span>
                <span className="font-mono text-[#9AB7FF]">{selectedRun.run.id}</span>
                <span className="text-[10px] font-bold uppercase text-gray-400 block mt-2">Owner Profile ID</span>
                <span className="font-mono text-gray-300">{selectedRun.run.owner_id}</span>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Approved Plan:</span>
                <pre className="p-3 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-[10px] overflow-x-auto text-gray-300 font-mono">
                  {JSON.stringify(selectedRun.run.approved_plan, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-gray-400 font-bold block mb-1">Transformation Steps ({selectedRun.steps?.length || 0}):</span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedRun.steps?.map((st: any) => (
                    <div key={st.id} className="p-2.5 rounded-lg bg-[#101B35] border border-[#2A3D6A] text-[11px]">
                      <div className="font-bold text-[#9AB7FF]">Step {st.step_order}: {st.operation_type}</div>
                      <div className="text-gray-400 mt-0.5">{st.result_summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-12 text-center">
              Click 'Details' on any execution run to inspect step-level metadata.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
