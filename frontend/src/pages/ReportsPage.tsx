import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileSpreadsheet,
  FileText,
  Download,
  Code2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Table,
  Sparkles,
} from 'lucide-react'
import { reportsApi } from '../lib/api'
import { Report } from '../types'

export const ReportsPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'
  const [searchParams] = useSearchParams()

  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [exportingType, setExportingType] = useState<string | null>(null)

  const loadReports = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.list({ search: search || undefined })
      const list = res.data.items || []
      setReports(list)

      const targetId = searchParams.get('id')
      if (targetId) {
        const found = list.find((r: Report) => r.id === targetId)
        if (found) {
          fetchReportDetail(targetId)
        } else if (list.length > 0) {
          fetchReportDetail(list[0].id)
        }
      } else if (list.length > 0 && !selectedReport) {
        fetchReportDetail(list[0].id)
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const fetchReportDetail = async (id: string) => {
    try {
      const res = await reportsApi.get(id)
      setSelectedReport(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Trigger actual file download from backend binary responses
  const triggerDownload = (data: any, filename: string, type: string) => {
    const blob = new Blob([data], { type })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleExport = async (type: 'pdf' | 'html' | 'csv' | 'xlsx' | 'json' | 'python') => {
    if (!selectedReport) return
    setExportingType(type)
    try {
      if (type === 'pdf') {
        const res = await reportsApi.exportPDF(selectedReport.id)
        triggerDownload(res.data, `DataMend_Report_${selectedReport.id.slice(0, 8)}.pdf`, 'application/pdf')
      } else if (type === 'html') {
        const res = await reportsApi.exportHTML(selectedReport.id)
        triggerDownload(res.data, `DataMend_Report_${selectedReport.id.slice(0, 8)}.html`, 'text/html')
      } else if (type === 'csv') {
        const res = await reportsApi.exportCSV(selectedReport.id)
        triggerDownload(res.data, `Cleaned_Dataset_${selectedReport.id.slice(0, 8)}.csv`, 'text/csv')
      } else if (type === 'xlsx') {
        const res = await reportsApi.exportXLSX(selectedReport.id)
        triggerDownload(
          res.data,
          `Cleaned_Dataset_${selectedReport.id.slice(0, 8)}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      } else if (type === 'json') {
        const res = await reportsApi.exportJSON(selectedReport.id)
        triggerDownload(
          typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2),
          `Cleaned_Dataset_${selectedReport.id.slice(0, 8)}.json`,
          'application/json'
        )
      } else if (type === 'python') {
        const res = await reportsApi.exportPython(selectedReport.id)
        triggerDownload(res.data, `datamend_pipeline_${selectedReport.id.slice(0, 8)}.py`, 'text/x-python')
      }
    } catch (err) {
      alert(`Export error: ${(err as any).message || 'Failed to download file'}`)
    } finally {
      setExportingType(null)
    }
  }

  const summary = selectedReport?.summary || ({} as any)
  const bQuality = summary.before_quality || {}
  const aQuality = summary.after_quality || {}

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('reports.title', 'Reports & Export')}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {isHi
              ? 'स्वचालित रूप से उत्पन्न ऑडिट रिपोर्ट और वास्तविक डाउनलोड (PDF, HTML, CSV, Excel, JSON और पायथन)'
              : 'Persistent audit reports and genuine file exports (PDF, HTML, CSV, XLSX, JSON, and Python).'}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadReports()}
            placeholder="Search reports..."
            className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports History List (Left Column) */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--color-accent)]" />
            <span>{t('reports.myReports', 'Report History')} ({reports.length})</span>
          </h3>

          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center animate-pulse-soft">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">
              {t('reports.noReports', 'No reports available yet. Clean a dataset in the Data Lab to generate one.')}
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id
                return (
                  <div
                    key={rep.id}
                    onClick={() => fetchReportDetail(rep.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-medium'
                        : 'border-gray-200/50 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate max-w-[170px]">{rep.title}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(rep.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      Prompt: "{rep.summary?.prompt || 'Data cleaning'}"
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Report Detail & Genuine Download Actions (Right 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedReport ? (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-6">
              {/* Header */}
              <div className="pb-4 border-b border-gray-200/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                      Completed & Persisted
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">ID: {selectedReport.id.slice(0, 8)}</span>
                  </div>
                  <h2 className="text-lg font-black mt-1.5">{selectedReport.title}</h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>Generated on {new Date(selectedReport.created_at).toLocaleString()}</span>
                  </p>
                </div>
              </div>

              {/* Original Prompt & Objective */}
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 space-y-1 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  User Objective & Cleaning Prompt
                </span>
                <p className="text-purple-950 dark:text-purple-100 font-semibold italic">
                  "{summary.prompt || 'Clean and prepare dataset'}"
                </p>
              </div>

              {/* Before vs After Transformation Metrics */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Transformation Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Rows Before</span>
                    <span className="text-base font-black mt-0.5 block">{bQuality.total_rows ?? 'N/A'}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Rows After</span>
                    <span className="text-base font-black mt-0.5 block">{aQuality.total_rows ?? 'N/A'}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Duplicate Rows</span>
                    <span className="text-base font-black mt-0.5 block text-green-600">
                      {bQuality.duplicate_rows ?? 0} → {aQuality.duplicate_rows ?? 0}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Missing Cells</span>
                    <span className="text-base font-black mt-0.5 block text-green-600">
                      {bQuality.missing_cells ?? 0} → {aQuality.missing_cells ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Findings */}
              {summary.key_findings?.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Key Findings</span>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                    {summary.key_findings.map((finding: string, fIdx: number) => (
                      <li key={fIdx}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Genuine Export Buttons */}
              <div className="pt-4 border-t border-gray-200/40 space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Export Genuine Files (Downloads)
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingType === 'pdf' ? 'Generating PDF...' : 'Download PDF Report'}</span>
                  </button>

                  <button
                    onClick={() => handleExport('html')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{exportingType === 'html' ? 'Generating HTML...' : 'Download HTML Report'}</span>
                  </button>

                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingType === 'csv' ? 'Preparing CSV...' : 'Cleaned CSV'}</span>
                  </button>

                  <button
                    onClick={() => handleExport('xlsx')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingType === 'xlsx' ? 'Preparing Excel...' : 'Cleaned Excel (XLSX)'}</span>
                  </button>

                  <button
                    onClick={() => handleExport('json')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingType === 'json' ? 'Preparing JSON...' : 'Cleaned JSON'}</span>
                  </button>

                  <button
                    onClick={() => handleExport('python')}
                    disabled={exportingType !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{exportingType === 'python' ? 'Generating Script...' : 'Reproducible Python Script'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-gray-400 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200/50">
              Select a report from the history list to inspect results and download files.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
