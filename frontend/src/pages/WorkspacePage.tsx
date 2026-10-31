import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileSpreadsheet,
  Activity,
  FileCheck,
  UploadCloud,
  Search,
  Filter,
  ArrowUpRight,
  Trash2,
  Play,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { datasetsApi, processingApi, reportsApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { Dataset, AnalysisRun, Report } from '../types'

export const WorkspacePage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formatFilter, setFormatFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [dsRes, runsRes, repRes] = await Promise.all([
        datasetsApi.list({ search, format: formatFilter || undefined }),
        processingApi.getRuns({ limit: 5 }),
        reportsApi.list({ limit: 5 }),
      ])
      setDatasets(dsRes.data.datasets || [])
      setRuns(runsRes.data.runs || [])
      setReports(repRes.data.items || [])
    } catch (err) {
      console.error('Error fetching workspace data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [formatFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadData()
  }

  const handleDeleteDataset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(isHi ? 'क्या आप इस डेटासेट को हटाना चाहते हैं?' : 'Delete this dataset permanently?')) {
      return
    }
    try {
      await datasetsApi.delete(id)
      setDatasets((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      alert(isHi ? 'डेटासेट हटाने में त्रुटि।' : 'Failed to delete dataset.')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {t('workspace.welcome', { name: user?.display_name || user?.email?.split('@')[0] || 'Researcher' })}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isHi
              ? 'यहाँ आपके सभी सक्रिय डेटासेट, चल रहे विश्लेषण और सहेजी गई रिपोर्टें उपलब्ध हैं।'
              : 'Your centralized workspace for persistent datasets, active runs, and audit reports.'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/data-lab"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{t('workspace.uploadDataset', 'Upload Dataset')}</span>
          </Link>
          <Link
            to="/how-to-use"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs transition-colors"
          >
            <BookOpen className="w-4 h-4 text-gray-500" />
            <span>{isHi ? 'मार्गदर्शिका' : 'Guide'}</span>
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('workspace.totalDatasets', 'Total Datasets')}</p>
            <p className="text-2xl font-black mt-0.5">{datasets.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('workspace.analysisRuns', 'Analysis Runs')}</p>
            <p className="text-2xl font-black mt-0.5">{runs.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('workspace.savedReports', 'Saved Reports')}</p>
            <p className="text-2xl font-black mt-0.5">{reports.length}</p>
          </div>
        </div>
      </div>

      {/* Dataset Library with Search & Filtering */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{t('workspace.recentDatasets', 'Recent Datasets')}</h2>
            <p className="text-xs text-gray-500">{isHi ? 'आपके द्वारा अपलोड और संसाधित की गई फ़ाइलें' : 'Your uploaded and processed dataset library'}</p>
          </div>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('workspace.searchDatasets', 'Search datasets...')}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-black/30 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </form>

            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              aria-label={t('workspace.filterBy', 'Filter by format')}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-black/30 text-xs focus:outline-none"
            >
              <option value="">{isHi ? 'सभी प्रारूप' : 'All Formats'}</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400 animate-pulse-soft">
            {t('common.loading', 'Loading workspace...')}
          </div>
        ) : datasets.length === 0 ? (
          /* Empty state for new users */
          <div className="p-10 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-center bg-white/40 dark:bg-black/10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold">{t('workspace.noDatasets', 'No datasets yet')}</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {isHi
                ? 'CSV, Excel या JSON फ़ाइल अपलोड करके शुरुआत करें। आप प्राकृतिक भाषा में निर्देश देकर डेटा साफ़ कर सकते हैं।'
                : 'Upload your first CSV, Excel, or JSON dataset. You can prompt-clean it, visualize distributions, and generate reports.'}
            </p>
            <Link
              to="/data-lab"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold shadow-sm"
            >
              <span>{t('workspace.uploadDataset', 'Upload Dataset')}</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d) => (
              <div
                key={d.id}
                onClick={() => navigate(`/data-lab?id=${d.id}`)}
                className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 hover:shadow-md hover:border-[var(--color-accent)]/40 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                      {d.file_format || 'csv'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteDataset(d.id, e)}
                      title="Delete"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-sm truncate group-hover:text-[var(--color-accent)] transition-colors">
                    {d.original_filename || d.filename}
                  </h3>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span><b>{d.row_count?.toLocaleString() || 0}</b> {t('common.rows', 'rows')}</span>
                    <span>•</span>
                    <span><b>{d.column_count || 0}</b> {t('common.columns', 'cols')}</span>
                    <span>•</span>
                    <span>{Math.round((d.file_size || 0) / 1024)} KB</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200/40 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-[var(--color-accent)] font-semibold flex items-center gap-1">
                    {t('workspace.openInDataLab', 'Open Lab')} →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Analyses & Reports Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Analysis Runs */}
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>{t('workspace.recentAnalyses', 'Recent Analysis Runs')}</span>
            </h3>
            <Link to="/insights" className="text-xs text-[var(--color-accent)] font-semibold hover:underline">
              {isHi ? 'सभी देखें' : 'View All'} →
            </Link>
          </div>

          {runs.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">{isHi ? 'कोई हालिया विश्लेषण नहीं है।' : 'No recent analysis runs.'}</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => navigate('/insights')}
                  className="p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors flex items-center justify-between cursor-pointer text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="font-semibold truncate">{r.original_prompt || 'Cleaning job'}</p>
                    <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Reports */}
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-green-600" />
              <span>{t('workspace.savedReports', 'Saved Reports')}</span>
            </h3>
            <Link to="/reports" className="text-xs text-[var(--color-accent)] font-semibold hover:underline">
              {isHi ? 'सभी देखें' : 'View All'} →
            </Link>
          </div>

          {reports.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">{isHi ? 'कोई रिपोर्ट उपलब्ध नहीं है।' : 'No saved reports.'}</p>
          ) : (
            <div className="space-y-2">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => navigate(`/reports?id=${rep.id}`)}
                  className="p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors flex items-center justify-between cursor-pointer text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="font-semibold truncate">{rep.title}</p>
                    <span className="text-[10px] text-gray-400">{new Date(rep.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    PDF/HTML
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
