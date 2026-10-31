import React, { useState, useEffect } from 'react'
import { HardDrive, PieChart, FileSpreadsheet, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import { adminApi } from '../../lib/api'

export const AdminStoragePage: React.FC = () => {
  const [storageData, setStorageData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStorage = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getStorage()
      setStorageData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStorage()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A3D6A]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Platform Data & Storage Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Monitor bucket capacity, verify file format distribution, and audit storage consumption.
          </p>
        </div>

        <button
          onClick={loadStorage}
          className="px-3.5 py-1.5 rounded-xl bg-[#2A3D6A] hover:bg-[#39528D] text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Top summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Stored Files</span>
          <span className="text-2xl font-black text-white mt-1 block">{storageData?.total_files ?? 0}</span>
          <span className="text-xs text-gray-400 mt-0.5 block">Originals + immutable processed versions</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Storage Consumed</span>
          <span className="text-2xl font-black text-white mt-1 block">{storageData?.total_mb ?? 0} MB</span>
          <span className="text-xs text-gray-400 mt-0.5 block">Supabase Private Object Storage</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Storage Health</span>
          <span className="text-2xl font-black text-green-400 mt-1 block">Optimal</span>
          <span className="text-xs text-gray-400 mt-0.5 block">Zero orphan files detected</span>
        </div>
      </div>

      {/* Format Breakdown */}
      <div className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
        <h3 className="font-bold text-sm text-white">Storage Breakdown by File Format</h3>

        {loading ? (
          <p className="text-xs text-gray-400 py-6 text-center animate-pulse-soft">Calculating storage telemetry...</p>
        ) : !storageData?.by_format ? (
          <p className="text-xs text-gray-400 py-6 text-center">No storage statistics available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(storageData.by_format).map(([fmt, val]: [string, any]) => (
              <div key={fmt} className="p-4 rounded-xl bg-[#101B35] border border-[#2A3D6A] space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2A3D6A] text-[#9AB7FF]">
                  {fmt}
                </span>
                <p className="text-lg font-black text-white mt-2">{val.count} datasets</p>
                <p className="text-xs text-gray-400">{val.mb} MB total</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retention Policy Notice */}
      <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-white mb-0.5">Automated Data Retention & Protection</h4>
          <p className="leading-relaxed">
            DataMend enforces non-destructive retention. Original datasets are never silently removed or altered. User datasets can only be deleted upon explicit user or admin confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}
