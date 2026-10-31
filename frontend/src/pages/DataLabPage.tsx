import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Code2,
  Table,
  Layers,
  Bookmark,
  Info,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { datasetsApi, processingApi } from '../lib/api'
import { Dataset, DatasetPreview, Plan, TransformationStep, SavedRecipe } from '../types'

export const DataLabPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<'upload' | 'prompt' | 'ledger' | 'recipes'>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Dataset state
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Prompt Lab state
  const [prompt, setPrompt] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [proposedPlan, setProposedPlan] = useState<Plan | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<any | null>(null)

  // Ledger & Recipes
  const [steps, setSteps] = useState<TransformationStep[]>([])
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [recipeName, setRecipeName] = useState('')
  const [pythonScript, setPythonScript] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const samplePrompts = [
    isHi ? 'डुप्लिकेट पंक्तियाँ हटाएं और संख्यात्मक स्तंभों में रिक्त मानों को उनकी माध्यिका (median) से भरें।' : 'Remove duplicate rows and fill missing values in numerical columns using their medians.',
    isHi ? 'सभी टेक्स्ट स्तंभों से अतिरिक्त स्पेस हटाएं और शहर के नामों को मानकीकृत करें।' : 'Trim whitespace from all text columns and lowercase category labels.',
    isHi ? 'वेतन (salary) स्तंभ में आउटलायर्स (outliers) का पता लगाएं और उन्हें चिह्नित करें।' : 'Find outliers in the salary column using IQR and flag them.',
    isHi ? 'केवल 2025 के रिकॉर्ड रखें और शेष डेटा को फ़िल्टर करें।' : 'Filter rows to keep only records where year is 2025.',
  ]

  // If URL has dataset ID, load it
  useEffect(() => {
    const datasetId = searchParams.get('id')
    if (datasetId) {
      loadDataset(datasetId)
    }
  }, [searchParams])

  const loadDataset = async (datasetId: string) => {
    setLoadingPreview(true)
    setErrorMsg(null)
    try {
      const dsRes = await datasetsApi.get(datasetId)
      setCurrentDataset(dsRes.data)

      const verRes = await datasetsApi.getVersions(datasetId)
      const verList = verRes.data || []
      setVersions(verList)

      if (verList.length > 0) {
        const latestVer = verList[verList.length - 1]
        setSelectedVersionId(latestVer.id)
        await loadPreview(datasetId, latestVer.id)
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load dataset.')
    } finally {
      setLoadingPreview(false)
    }
  }

  const loadPreview = async (datasetId: string, versionId: string) => {
    try {
      const prevRes = await datasetsApi.getPreview(datasetId, versionId)
      setPreview(prevRes.data)
    } catch (err) {
      console.error('Error fetching preview:', err)
    }
  }

  // File Dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const file = acceptedFiles[0]

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    setErrorMsg(null)
    setUploadProgress(10)

    try {
      const res = await datasetsApi.upload(formData, (pct: number) => setUploadProgress(pct))
      const { dataset_id, version_id } = res.data
      await loadDataset(dataset_id)
      setActiveTab('prompt')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'File upload failed. Ensure format is CSV, Excel, or JSON.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })

  // Interpret natural-language prompt
  const handleInterpret = async () => {
    if (!prompt.trim() || !currentDataset || !selectedVersionId) return
    setInterpreting(true)
    setErrorMsg(null)
    setProposedPlan(null)

    try {
      const res = await processingApi.interpret({
        prompt,
        dataset_id: currentDataset.id,
        version_id: selectedVersionId,
      })
      setProposedPlan(res.data)
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Could not interpret cleaning instruction.')
    } finally {
      setInterpreting(false)
    }
  }

  // Execute approved plan
  const handleExecutePlan = async () => {
    if (!proposedPlan || !currentDataset || !selectedVersionId) return
    setExecuting(true)
    setErrorMsg(null)

    try {
      const res = await processingApi.execute({
        dataset_id: currentDataset.id,
        version_id: selectedVersionId,
        plan: proposedPlan,
      })
      setExecutionResult(res.data)
      // Reload versions and preview
      await loadDataset(currentDataset.id)
      setProposedPlan(null)
      setPrompt('')
      setActiveTab('ledger')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to execute cleaning plan.')
    } finally {
      setExecuting(false)
    }
  }

  // Save current plan as reusable recipe
  const handleSaveRecipe = async () => {
    if (!recipeName || !proposedPlan) return
    try {
      await processingApi.saveRecipe({
        name: recipeName,
        description: proposedPlan.objective,
        operations: proposedPlan.operations,
      })
      alert(isHi ? 'विधि सफलतापूर्वक सहेजी गई!' : 'Recipe saved successfully!')
      setRecipeName('')
      loadRecipes()
    } catch (err) {
      alert('Failed to save recipe.')
    }
  }

  const loadRecipes = async () => {
    try {
      const res = await processingApi.getRecipes()
      setRecipes(res.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Title & Dataset Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('dataLab.title', 'Data Lab')}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {isHi
              ? 'डेटा अपलोड करें, प्राकृतिक भाषा में सफ़ाई का अनुरोध करें और योजना को स्वीकृत करके निष्पादित करें।'
              : 'Upload datasets, request cleaning in natural language, review the transparent plan, and execute.'}
          </p>
        </div>

        {currentDataset && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Active Dataset</span>
              <span className="text-xs font-bold text-[var(--color-accent)] truncate max-w-[200px] block">
                {currentDataset.original_filename}
              </span>
            </div>

            {versions.length > 1 && (
              <select
                value={selectedVersionId}
                onChange={(e) => {
                  setSelectedVersionId(e.target.value)
                  loadPreview(currentDataset.id, e.target.value)
                }}
                aria-label={isHi ? 'डेटा संस्करण' : 'Dataset version'}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 text-xs font-semibold focus:outline-none"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} {v.is_original ? '(Original)' : '(Cleaned)'} - {v.row_count} rows
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/50 pb-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'upload'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>{isHi ? 'अपलोड और पूर्वावलोकन' : 'Upload & Inspection'}</span>
        </button>

        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'prompt'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('dataLab.promptLab', 'Prompt Lab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ledger'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('dataLab.ledger', 'Transformation Ledger')}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('recipes')
            loadRecipes()
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'recipes'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>{t('dataLab.recipes', 'Saved Recipes')}</span>
        </button>
      </div>

      {/* TAB 1: Upload & Inspection */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.01]'
                : 'border-gray-300 dark:border-gray-700 hover:border-[var(--color-accent)] bg-white/40 dark:bg-black/10'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">
              {isDragActive ? 'Drop file here...' : t('dataLab.dragDrop', 'Drag & drop your dataset here, or browse')}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {t('dataLab.supportedFormats', 'Supported formats: CSV, Excel (.xlsx, .xls), JSON (Max 50MB)')}
            </p>

            {uploading && (
              <div className="mt-4 max-w-xs mx-auto">
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[var(--color-accent)] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 mt-1 block">Uploading {uploadProgress}%</span>
              </div>
            )}
          </div>

          {/* Dataset Preview & Quality Profile */}
          {preview && (
            <div className="space-y-6">
              {/* Quality summary badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/70 dark:bg-black/20 border border-gray-200/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Rows</span>
                  <span className="text-xl font-black mt-0.5 block">{preview.total_rows.toLocaleString()}</span>
                </div>
                <div className="p-4 rounded-xl bg-white/70 dark:bg-black/20 border border-gray-200/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Columns</span>
                  <span className="text-xl font-black mt-0.5 block">{preview.total_cols}</span>
                </div>
                <div className="p-4 rounded-xl bg-white/70 dark:bg-black/20 border border-gray-200/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Missing Cells</span>
                  <span className={`text-xl font-black mt-0.5 block ${preview.quality_summary.missing_cells > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                    {preview.quality_summary.missing_cells} ({preview.quality_summary.missing_pct}%)
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/70 dark:bg-black/20 border border-gray-200/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Duplicate Rows</span>
                  <span className={`text-xl font-black mt-0.5 block ${preview.quality_summary.duplicate_rows > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {preview.quality_summary.duplicate_rows} ({preview.quality_summary.duplicate_pct}%)
                  </span>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="p-5 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Table className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>{t('dataLab.preview', 'Data Preview')} (First 50 Rows)</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('prompt')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold"
                  >
                    <span>Clean in Prompt Lab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto max-h-96 border border-gray-200/40 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-gray-100/80 dark:bg-gray-900/80 sticky top-0 backdrop-blur-sm z-10">
                      <tr>
                        {preview.columns.map((col: any) => (
                          <th key={col.name} className="p-2.5 font-bold border-b border-gray-200/60 whitespace-nowrap">
                            <div>{col.name}</div>
                            <div className="text-[10px] font-normal text-gray-400">
                              {col.dtype} {col.missing_count > 0 && `(${col.missing_count} null)`}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/30">
                      {preview.rows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          {preview.columns.map((col: any) => (
                            <td key={col.name} className="p-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                              {row[col.name] === null || row[col.name] === undefined ? (
                                <span className="text-red-400 italic font-mono text-[10px]">null</span>
                              ) : (
                                String(row[col.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Natural-Language Prompt Lab */}
      {activeTab === 'prompt' && (
        <div className="space-y-6">
          {!currentDataset ? (
            <div className="p-8 text-center text-xs text-gray-500 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200/50">
              Please upload or select a dataset first to use the Prompt Lab.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Prompt Editor */}
              <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>{t('dataLab.promptLab', 'Natural Language Prompt Lab')}</span>
                  </h3>
                  <span className="text-[11px] text-gray-400 font-medium">
                    Predefined, safe & verified operations
                  </span>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('dataLab.promptPlaceholder', 'e.g. Remove duplicate rows and fill missing values in numeric columns with median')}
                  rows={4}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />

                {/* Example Prompts Chips */}
                <div>
                  <span className="text-[11px] font-bold text-gray-400 block mb-2">Example Prompts:</span>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((sp, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPrompt(sp)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        "{sp}"
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    onClick={handleInterpret}
                    disabled={interpreting || !prompt.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {interpreting ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{t('dataLab.interpretPrompt', 'Generate Proposed Plan')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Proposed Transformation Plan Review Card */}
              {proposedPlan && (
                <div className="p-6 rounded-2xl bg-white dark:bg-black/30 border-2 border-[var(--color-accent)] shadow-lg space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200/50">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] block">
                        {t('dataLab.approvedPlan', 'Proposed Transformation Plan')}
                      </span>
                      <h3 className="font-extrabold text-base mt-0.5">{proposedPlan.objective}</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      Requires Approval
                    </span>
                  </div>

                  {/* Operations List */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-500 block">Planned Operations ({proposedPlan.operations.length})</span>
                    {proposedPlan.operations.map((op: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[var(--color-accent)]">{op.operation_type}</span>
                          <span className="text-[10px] text-gray-400">Step {idx + 1}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{op.description}</p>
                        {op.affected_columns?.length > 0 && (
                          <div className="text-[11px] text-gray-400">
                            Affected columns: <span className="font-mono">{op.affected_columns.join(', ')}</span>
                          </div>
                        )}
                        {op.warnings?.length > 0 && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{op.warnings.join('; ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Warnings & Assumptions */}
                  {proposedPlan.warnings?.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                      <b>Warnings:</b> {proposedPlan.warnings.join(' ')}
                    </div>
                  )}

                  {/* Actions: Save Recipe or Approve & Execute */}
                  <div className="pt-4 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        placeholder="Recipe Name"
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-xs focus:outline-none"
                      />
                      <button
                        onClick={handleSaveRecipe}
                        disabled={!recipeName}
                        className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 text-xs font-semibold disabled:opacity-40"
                      >
                        Save Recipe
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setProposedPlan(null)}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 text-xs font-semibold"
                      >
                        {t('dataLab.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={handleExecutePlan}
                        disabled={executing}
                        className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {executing ? (
                          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('dataLab.execute', 'Approve & Execute')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Transformation Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-accent)]" />
                <span>{t('dataLab.ledger', 'Transformation Ledger')}</span>
              </h3>
              {executionResult && (
                <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Latest execution succeeded</span>
                </span>
              )}
            </div>

            {executionResult ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs space-y-1">
                  <p className="font-bold text-green-800 dark:text-green-300">
                    Execution Result: Rows affected: {executionResult.rows_before} → {executionResult.rows_after}
                  </p>
                  <p className="text-green-700 dark:text-green-400">
                    Created new immutable version (v{versions.length + 1}). Original file is preserved.
                  </p>
                </div>

                <div className="space-y-2">
                  {executionResult.steps?.map((st: any, sIdx: number) => (
                    <div key={sIdx} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--color-accent)]">Step {sIdx + 1}: {st.operation_type}</span>
                        <span className="text-gray-400">{st.rows_affected} rows affected</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">{st.result_summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-6 text-center">
                Execute an approved transformation in the Prompt Lab to view the audit ledger.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Saved Recipes */}
      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-black/20 border border-gray-200/50 shadow-sm space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[var(--color-accent)]" />
              <span>{t('dataLab.recipes', 'Saved Cleaning Recipes')}</span>
            </h3>

            {recipes.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                No saved recipes yet. Save a transformation plan from the Prompt Lab to reuse it later.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/50 space-y-2">
                    <h4 className="font-bold text-sm">{rec.name}</h4>
                    <p className="text-xs text-gray-500">{rec.description || 'Custom cleaning pipeline'}</p>
                    <span className="text-[11px] text-gray-400 block">{rec.operations?.length || 0} operations configured</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
