// ===== DataMend Type Definitions =====

export type ThemeKey = 'lavender' | 'blush' | 'sage' | 'midnight'
export type Language = 'en' | 'hi'
export type UserRole = 'user' | 'admin'
export type DatasetFormat = 'csv' | 'xlsx' | 'xls' | 'json'

export interface Theme {
  bg: string
  accent: string
  text: string
  name: string
}

export interface User {
  id: string
  email: string
  display_name: string
  role: UserRole
  theme: ThemeKey
  language: Language
  first_login: boolean
  is_suspended?: boolean
  created_at?: string
  updated_at?: string
}

export interface Dataset {
  id: string
  owner_id?: string
  user_id?: string
  filename: string
  original_filename: string
  file_format?: DatasetFormat
  format?: DatasetFormat
  file_size?: number
  file_size_bytes?: number
  row_count: number
  column_count?: number
  col_count?: number
  tags?: string[]
  upload_status?: string
  status?: string
  created_at: string
  updated_at?: string
}

export interface ColumnInfo {
  name: string
  dtype: string
  missing_count: number
  missing_pct: number
  unique_count: number
  sample_values?: any[]
}

export interface QualityProfile {
  total_rows: number
  total_cols: number
  missing_cells: number
  missing_pct: number
  duplicate_rows: number
  duplicate_pct: number
  per_column?: Record<string, ColumnInfo>
}

export interface DatasetPreview {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  total_rows: number
  total_cols: number
  quality_summary: QualityProfile
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  version_number: number
  storage_path?: string
  row_count: number
  column_count?: number
  is_original?: boolean
  created_at: string
}

export interface Operation {
  operation_type: string
  parameters: Record<string, any>
  affected_columns: string[]
  description: string
  warnings: string[]
}

export interface Plan {
  objective: string
  operations: Operation[]
  assumptions: string[]
  warnings: string[]
  estimated_impact: string
}

export interface TransformationStep {
  id?: string
  analysis_run_id?: string
  run_id?: string
  step_order?: number
  step_index?: number
  operation_type: string
  parameters?: Record<string, any>
  affected_columns?: string[]
  rows_affected: number
  result_summary: string
  warnings?: string[]
  created_at?: string
}

export interface AnalysisRun {
  id: string
  owner_id?: string
  user_id?: string
  dataset_version_id?: string
  original_prompt?: string
  approved_plan?: any
  status: string
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  created_at: string
}

export interface ReportSummary {
  prompt?: string
  before_quality?: QualityProfile
  after_quality?: QualityProfile
  operations_count?: number
  rows_affected?: number
  key_findings?: string[]
}

export interface Report {
  id: string
  owner_id?: string
  user_id?: string
  analysis_run_id?: string
  title: string
  status?: string
  storage_path?: string | null
  summary: ReportSummary
  created_at: string
  updated_at?: string
}

export interface SavedRecipe {
  id: string
  owner_id?: string
  name: string
  description?: string
  operations: Operation[]
  created_at?: string
}

export interface AdminDashboard {
  total_users: number
  active_users_7d: number
  active_users_30d: number
  total_datasets: number
  total_analysis_runs: number
  successful_runs: number
  failed_runs: number
  total_storage_bytes: number
  recent_runs: AnalysisRun[]
}

export interface AdminUser {
  id: string
  email: string
  display_name: string
  role: UserRole
  created_at: string
  dataset_count?: number
  datasets_count?: number
  run_count?: number
  runs_count?: number
  is_suspended?: boolean
}

export interface AdminAuditLog {
  id: string
  admin_id?: string
  action_type?: string
  target_user_id?: string | null
  target_resource?: string | null
  metadata?: Record<string, any>
  ip_address?: string | null
  created_at: string
}

export interface StatisticsResult {
  dataset_version_id: string
  columns: Record<string, any>
}

export interface ChartRecommendation {
  chart_type: string
  x_column?: string
  y_column?: string
  reason: string
  priority: number
}

export interface ComparisonResult {
  version_id_1: string
  version_id_2: string
  metrics_diff: {
    v1: Record<string, any>
    v2: Record<string, any>
    deltas: Record<string, number>
  }
  schema_diff?: {
    added_columns: string[]
    removed_columns: string[]
    type_changes: { column: string; from: string; to: string }[]
  }
}
