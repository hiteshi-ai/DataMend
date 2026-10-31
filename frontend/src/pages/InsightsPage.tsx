import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Plot from 'react-plotly.js'
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GitCompare,
  Sparkles,
  HelpCircle,
  Table as TableIcon,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  Layers,
} from 'lucide-react'
import { datasetsApi, insightsApi } from '../lib/api'
import { Dataset, DatasetVersion, StatisticsResult, ChartRecommendation, ComparisonResult } from '../types'

export const InsightsPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'

  const [activeTab, setActiveTab] = useState<'stats' | 'charts' | 'compare'>('stats')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')

  // Statistics state
  const [statsData, setStatsData] = useState<StatisticsResult | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [selectedCol, setSelectedCol] = useState<string>('')

  // Chart state
  const [chartType, setChartType] = useState<string>('histogram')
  const [xCol, setXCol] = useState<string>('')
  const [yCol, setYCol] = useState<string>('')
  const [plotlyFigure, setPlotlyFigure] = useState<any | null>(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([])

  // Comparison state
  const [compVersion1, setCompVersion1] = useState<string>('')
  const [compVersion2, setCompVersion2] = useState<string>('')
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [loadingComp, setLoadingComp] = useState(false)

  // 1. Initial Load: Datasets
  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    try {
      const res = await datasetsApi.list({ limit: 50 })
      const dsList = res.data.datasets || []
      setDatasets(dsList)
      if (dsList.length > 0) {
        setSelectedDatasetId(dsList[0].id)
        loadVersions(dsList[0].id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadVersions = async (datasetId: string) => {
    try {
      const res = await datasetsApi.getVersions(datasetId)
      const vList = res.data || []
      setVersions(vList)
      if (vList.length > 0) {
        const latest = vList[vList.length - 1]
        setSelectedVersionId(latest.id)
        // Also set default comparison versions if multiple
        if (vList.length >= 2) {
          setCompVersion1(vList[0].id)
          setCompVersion2(vList[vList.length - 1].id)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 2. Load Stats whenever version changes
  useEffect(() => {
    if (selectedDatasetId && selectedVersionId) {
      fetchStatistics()
      fetchRecommendations()
    }
  }, [selectedDatasetId, selectedVersionId])

  const fetchStatistics = async () => {
    setLoadingStats(true)
    try {
      const res = await insightsApi.getStatistics({
        dataset_id: selectedDatasetId,
        version_id: selectedVersionId,
      })
      setStatsData(res.data)
      const cols = Object.keys(res.data.columns || {})
      if (cols.length > 0 && !selectedCol) {
        setSelectedCol(cols[0])
      }
      if (cols.length > 0 && !xCol) {
        setXCol(cols[0])
      }
      if (cols.length > 1 && !yCol) {
        setYCol(cols[1])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchRecommendations = async () => {
    try {
      const res = await insightsApi.getRecommendations({
        dataset_id: selectedDatasetId,
        version_id: selectedVersionId,
      })
      setRecommendations(res.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // 3. Render Plotly Chart
  const handleRenderChart = async () => {
    if (!selectedVersionId) return
    setLoadingChart(true)
    try {
      const res = await insightsApi.generateChart({
        dataset_version_id: selectedVersionId,
        chart_type: chartType,
        x_column: xCol || undefined,
        y_column: yCol || undefined,
      })
      setPlotlyFigure(res.data.figure)
    } catch (err) {
      console.error('Error generating chart:', err)
    } finally {
      setLoadingChart(false)
    }
  }

  // Trigger chart on tab switch or params
  useEffect(() => {
    if (activeTab === 'charts' && selectedVersionId && xCol) {
      handleRenderChart()
    }
  }, [activeTab, chartType, xCol, yCol, selectedVersionId])

  // 4. Compare Datasets
  const handleCompare = async () => {
    if (!compVersion1 || !compVersion2) return
    setLoadingComp(true)
    try {
      const res = await insightsApi.compare({
        version_id_1: compVersion1,
        version_id_2: compVersion2,
      })
      setComparisonResult(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingComp(false)
    }
  }

  const columnsList = statsData ? Object.keys(statsData.columns) : []

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header & Dataset Version Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('insights.title', 'Insights & Compare')}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {isHi
              ? 'वैज्ञानिक सांख्यिकी, इंटरएक्टिव चार्ट और ऐतिहासिक संस्करणों की पारदर्शी तुलना।'
              : 'Statistical analysis, interactive Plotly visualizations, and evidence-based historical comparison.'}
          </p>
        </div>

        {/* Dataset + Version Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDatasetId}
            onChange={(e) => {
              setSelectedDatasetId(e.target.value)
              loadVersions(e.target.value)
            }}
            aria-label={isHi ? 'डेटासेट चुनें' : 'Select dataset'}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.original_filename}
              </option>
            ))}
          </select>

          <select
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            aria-label={isHi ? 'डेटा संस्करण' : 'Dataset version'}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version_number} {v.is_original ? '(Original)' : '(Cleaned)'} - {v.row_count} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/50 pb-2">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'stats'
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          <TableIcon className="w-4 h-4" />
          <span>{t('insights.statistics', 'Descriptive Statistics')}</span>
        </button>

        <button
          onClick={() => setActiveTab('charts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'charts'
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          <LineChart className="w-4 h-4" />
          <span>{t('insights.charts', 'Interactive Plotly Charts')}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('compare')
            if (compVersion1 && compVersion2) handleCompare()
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'compare'
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
          <GitCompare className="w-4 h-4" />
          <span>{t('insights.compare', 'Historical Comparison')}</span>
        </button>
      </div>

      {/* TAB 1: Descriptive Statistics */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {loadingStats ? (
            <div className="p-12 text-center text-xs text-gray-400 animate-pulse-soft">
              Computing descriptive measures...
            </div>
          ) : !statsData ? (
            <div className="p-8 text-center text-xs text-gray-500 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200/50">
              Select a dataset and version to inspect statistics.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Column selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-bold text-gray-400 shrink-0">Column:</span>
                {columnsList.map((col) => {
                  const isNum = statsData.columns[col]?.is_numeric
                  return (
                    <button
                      key={col}
                      onClick={() => setSelectedCol(col)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedCol === col
                        ? 'bg-[var(--color-accent)] text-white shadow-sm'
                        : 'bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                    >
                      {col} {isNum ? '(#)' : '(A)'}
                    </button>
                  )
                })}
              </div>

              {/* Selected Column Stats Details */}
              {selectedCol && statsData.columns[selectedCol] && (
                <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200/40">
                    <div>
                      <h3 className="font-extrabold text-base">{selectedCol}</h3>
                      <span className="text-xs text-gray-400">
                        Type: {statsData.columns[selectedCol].dtype} • Missing: {statsData.columns[selectedCol].missing_count} ({statsData.columns[selectedCol].missing_pct}%)
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      {statsData.columns[selectedCol].unique_count} unique values
                    </span>
                  </div>

                  {statsData.columns[selectedCol].is_numeric ? (
                    /* Numerical Measures Grid */
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.mean', 'Mean')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].mean ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.median', 'Median')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].median ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.std', 'Std Dev')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].std ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Variance</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].variance ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.min', 'Min')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].min ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.max', 'Max')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].max ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.skewness', 'Skewness')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].skewness ?? 'N/A'}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('insights.kurtosis', 'Kurtosis')}</span>
                        <span className="text-lg font-black mt-0.5 block">{statsData.columns[selectedCol].kurtosis ?? 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    /* Categorical Frequencies */
                    <div>
                      <span className="text-xs font-bold text-gray-400 block mb-2">Top Value Frequencies</span>
                      <div className="space-y-1.5">
                        {Object.entries(statsData.columns[selectedCol].value_counts || {}).map(([val, cnt]) => (
                          <div key={val} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <span className="font-semibold truncate">{val}</span>
                            <span className="text-gray-400">{String(cnt)} occurrences</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Interactive Plotly Charts */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Chart Controls */}
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Chart Type</label>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
                >
                  <option value="histogram">Histogram (Distribution)</option>
                  <option value="bar">Bar Chart</option>
                  <option value="scatter">Scatter Plot</option>
                  <option value="line">Line Chart</option>
                  <option value="box">Box Plot (Outliers)</option>
                  <option value="heatmap">Correlation Heatmap</option>
                  <option value="pie">Pie Chart</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">X-Axis</label>
                <select
                  value={xCol}
                  onChange={(e) => setXCol(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
                >
                  {columnsList.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              {['scatter', 'bar', 'line', 'box'].includes(chartType) && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Y-Axis</label>
                  <select
                    value={yCol}
                    onChange={(e) => setYCol(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">(None / Count)</option>
                    {columnsList.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleRenderChart}
                  disabled={loadingChart}
                  className="px-5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChart ? 'animate-spin' : ''}`} />
                  <span>Update Chart</span>
                </button>
              </div>
            </div>

            {/* Recommendations Chips */}
            {recommendations.length > 0 && (
              <div className="pt-2 border-t border-gray-200/40">
                <span className="text-[11px] font-bold text-gray-400 block mb-1.5">
                  AI Recommended Visualizations:
                </span>
                <div className="flex flex-wrap gap-2">
                  {recommendations.map((rec, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => {
                        setChartType(rec.chart_type)
                        if (rec.x_column) setXCol(rec.x_column)
                        if (rec.y_column) setYCol(rec.y_column)
                      }}
                      className="px-3 py-1 rounded-lg text-xs bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 border border-purple-200/60 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-medium"
                    >
                      {rec.chart_type.toUpperCase()} ({rec.x_column || 'matrix'}): {rec.reason}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Plotly Container */}
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm min-h-[450px] flex items-center justify-center">
            {loadingChart ? (
              <div className="text-xs text-gray-400 animate-pulse-soft">Rendering Plotly figure...</div>
            ) : plotlyFigure ? (
              <div className="w-full h-full min-h-[400px]">
                <Plot
                  data={plotlyFigure.data || []}
                  layout={{
                    ...plotlyFigure.layout,
                    autosize: true,
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { family: 'Inter, sans-serif', color: 'inherit' },
                  }}
                  useResizeHandler
                  style={{ width: '100%', height: '420px' }}
                  config={{ responsive: true, displayModeBar: true }}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-400">Select parameters above to render chart.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Historical Comparison */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[var(--color-accent)]" />
              <span>{t('insights.compare', 'Compare Datasets or Versions')}</span>
            </h3>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Baseline Version (V1)</label>
                <select
                  value={compVersion1}
                  onChange={(e) => setCompVersion1(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version_number} {v.is_original ? '(Original)' : '(Cleaned)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Target Version (V2)</label>
                <select
                  value={compVersion2}
                  onChange={(e) => setCompVersion2(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-xs font-semibold focus:outline-none"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version_number} {v.is_original ? '(Original)' : '(Cleaned)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleCompare}
                  disabled={loadingComp || !compVersion1 || !compVersion2}
                  className="px-5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loadingComp ? 'Comparing...' : 'Run Side-by-Side Comparison'}
                </button>
              </div>
            </div>

            {/* Comparison Metrics Display */}
            {comparisonResult && (
              <div className="space-y-6 pt-4 border-t border-gray-200/40">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Row Delta</span>
                    <span className="text-xl font-black mt-0.5 block">
                      {comparisonResult.metrics_diff.deltas.row_change >= 0 ? '+' : ''}
                      {comparisonResult.metrics_diff.deltas.row_change}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Column Delta</span>
                    <span className="text-xl font-black mt-0.5 block">
                      {comparisonResult.metrics_diff.deltas.column_change >= 0 ? '+' : ''}
                      {comparisonResult.metrics_diff.deltas.column_change}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Missing Cells Delta</span>
                    <span className="text-xl font-black mt-0.5 block text-green-600">
                      {comparisonResult.metrics_diff.deltas.missing_cells_change}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Duplicates Removed</span>
                    <span className="text-xl font-black mt-0.5 block text-green-600">
                      {Math.abs(comparisonResult.metrics_diff.deltas.duplicates_change)}
                    </span>
                  </div>
                </div>

                {/* Schema Changes */}
                {comparisonResult.schema_diff && (
                  <div className="p-4 rounded-xl bg-white dark:bg-black/30 border border-gray-200/40 space-y-2 text-xs">
                    <h4 className="font-bold">Schema & Type Changes</h4>
                    {comparisonResult.schema_diff.type_changes?.length === 0 ? (
                      <p className="text-gray-400">No data type modifications detected between selected versions.</p>
                    ) : (
                      <ul className="list-disc pl-5 space-y-1">
                        {comparisonResult.schema_diff.type_changes.map((tc: any, idx: number) => (
                          <li key={idx}>
                            Column <b>{tc.column}</b> converted from <span className="font-mono">{tc.from}</span> to <span className="font-mono text-green-600">{tc.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
