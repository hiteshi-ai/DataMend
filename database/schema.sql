-- =============================================================================
-- DataMend PostgreSQL Schema
-- =============================================================================
-- This schema is designed for use with Supabase (PostgreSQL + GoTrue auth).
-- All tables use UUID primary keys generated via gen_random_uuid().
-- Row Level Security (RLS) is enabled on every table.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROFILES
-- Extended user profile, linked to Supabase auth.users
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username        TEXT        UNIQUE,
    display_name    TEXT,
    role            TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    theme           TEXT        NOT NULL DEFAULT 'lavender',
    language        TEXT        NOT NULL DEFAULT 'en',
    is_suspended    BOOLEAN     NOT NULL DEFAULT false,
    first_login     BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Extended user profiles linked to Supabase auth.users.';
COMMENT ON COLUMN public.profiles.role IS 'User role: ''user'' (default) or ''admin''.';
COMMENT ON COLUMN public.profiles.theme IS 'UI theme preference, e.g. ''lavender'', ''dark'', ''light''.';
COMMENT ON COLUMN public.profiles.first_login IS 'True until the user completes onboarding for the first time.';

-- =============================================================================
-- 2. DATASETS
-- Tracks uploaded dataset files and their metadata
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.datasets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename            TEXT        NOT NULL,
    original_filename   TEXT        NOT NULL,
    file_format         TEXT        NOT NULL CHECK (file_format IN ('csv', 'xlsx', 'xls', 'json')),
    file_size           BIGINT,
    row_count           INT,
    column_count        INT,
    tags                TEXT[],
    upload_status       TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (upload_status IN ('pending', 'processing', 'ready', 'failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.datasets IS 'Uploaded datasets and their metadata.';
COMMENT ON COLUMN public.datasets.filename IS 'Internal storage filename (e.g. UUID-based).';
COMMENT ON COLUMN public.datasets.original_filename IS 'Original filename as uploaded by the user.';
COMMENT ON COLUMN public.datasets.tags IS 'Optional array of user-defined tags for filtering.';

-- =============================================================================
-- 3. DATASET_VERSIONS
-- Immutable snapshots of a dataset after each transformation pass
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dataset_versions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID        NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    version_number  INT         NOT NULL,
    storage_path    TEXT        NOT NULL,
    schema_snapshot JSONB,
    row_count       INT,
    column_count    INT,
    is_original     BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (dataset_id, version_number)
);

COMMENT ON TABLE public.dataset_versions IS 'Versioned snapshots of datasets; version 1 is always the original upload.';
COMMENT ON COLUMN public.dataset_versions.schema_snapshot IS 'JSON representation of column names and inferred data types at this version.';
COMMENT ON COLUMN public.dataset_versions.is_original IS 'True only for version 1 (the raw uploaded file).';

-- =============================================================================
-- 4. ANALYSIS_RUNS
-- Tracks a full cleaning / transformation job triggered by the user
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dataset_version_id  UUID        NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
    original_prompt     TEXT,
    approved_plan       JSONB,
    status              TEXT        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.analysis_runs IS 'Each row represents one AI-driven cleaning / analysis job.';
COMMENT ON COLUMN public.analysis_runs.original_prompt IS 'The raw user prompt that initiated the analysis, if any.';
COMMENT ON COLUMN public.analysis_runs.approved_plan IS 'The finalised plan (JSON) that the user confirmed before execution.';

-- =============================================================================
-- 5. TRANSFORMATION_STEPS
-- Individual operations executed within an analysis run
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transformation_steps (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_run_id     UUID        NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    step_order          INT         NOT NULL,
    operation_type      TEXT        NOT NULL,
    parameters          JSONB,
    affected_columns    TEXT[],
    rows_affected       INT,
    result_summary      TEXT,
    warnings            TEXT[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transformation_steps IS 'Ordered log of every operation executed during an analysis run.';
COMMENT ON COLUMN public.transformation_steps.operation_type IS 'e.g. ''drop_duplicates'', ''fill_nulls'', ''rename_column'', ''type_cast''.';
COMMENT ON COLUMN public.transformation_steps.parameters IS 'Operation-specific parameters (column name, fill value, etc.).';
COMMENT ON COLUMN public.transformation_steps.warnings IS 'Non-fatal warnings emitted during this step.';

-- =============================================================================
-- 6. QUALITY_CHECKS
-- Pre/post transformation data-quality assessments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.quality_checks (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id  UUID        NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
    check_type          TEXT        NOT NULL,
    result              JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.quality_checks IS 'Data quality check results scoped to a specific dataset version.';
COMMENT ON COLUMN public.quality_checks.check_type IS 'e.g. ''null_summary'', ''duplicate_check'', ''type_consistency'', ''outlier_detection''.';
COMMENT ON COLUMN public.quality_checks.result IS 'Structured result payload (counts, percentages, column-level detail, etc.).';

-- =============================================================================
-- 7. ANALYSIS_METRICS
-- Statistical / profile metrics computed during an analysis run
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_metrics (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_run_id UUID        NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    metric_type     TEXT        NOT NULL,
    column_name     TEXT,
    metric_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.analysis_metrics IS 'Per-column or dataset-level statistics produced by an analysis run.';
COMMENT ON COLUMN public.analysis_metrics.metric_type IS 'e.g. ''descriptive_stats'', ''correlation'', ''histogram'', ''value_counts''.';

-- =============================================================================
-- 8. REPORTS
-- Generated reports summarising an analysis run
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_run_id UUID        NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'generating'
                                CHECK (status IN ('generating', 'ready', 'failed')),
    storage_path    TEXT,
    summary         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.reports IS 'Human-readable summary reports linked to a completed analysis run.';
COMMENT ON COLUMN public.reports.summary IS 'High-level JSON summary: total rows cleaned, issues fixed, columns changed, etc.';

-- =============================================================================
-- 9. EXPORTS
-- Files exported by a user from a report or cleaned dataset
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_id       UUID        REFERENCES public.reports(id) ON DELETE SET NULL,
    export_type     TEXT        NOT NULL
                                CHECK (export_type IN ('csv', 'xlsx', 'json', 'pdf', 'html', 'python', 'log')),
    storage_path    TEXT        NOT NULL,
    file_size       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.exports IS 'Exported artefacts (cleaned data files, reports, code, logs).';
COMMENT ON COLUMN public.exports.export_type IS 'File format of the export.';

-- =============================================================================
-- 10. SAVED_RECIPES
-- Reusable transformation pipelines saved by users
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.saved_recipes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    description TEXT,
    operations  JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.saved_recipes IS 'Named, reusable sequences of transformation operations.';
COMMENT ON COLUMN public.saved_recipes.operations IS 'Ordered JSON array of operation objects, compatible with transformation_steps.parameters format.';

-- =============================================================================
-- 11. ACTIVITY_LOGS
-- Lightweight audit trail of user actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT        NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_logs IS 'Lightweight activity log for user-facing history / undo features.';
COMMENT ON COLUMN public.activity_logs.action_type IS 'e.g. ''upload'', ''run_analysis'', ''export'', ''delete_dataset''.';

-- =============================================================================
-- 12. ADMIN_AUDIT_LOGS
-- High-fidelity audit trail for admin actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type         TEXT        NOT NULL,
    target_user_id      UUID,
    target_resource     TEXT,
    metadata            JSONB,
    ip_address          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_audit_logs IS 'Tamper-evident log of all admin actions. Only admins can read; no one can delete via RLS.';
COMMENT ON COLUMN public.admin_audit_logs.target_resource IS 'The type or identifier of the affected resource (e.g. ''datasets'', ''profiles'').';

-- =============================================================================
-- 13. APP_SETTINGS
-- Global application configuration key/value store
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT        NOT NULL UNIQUE,
    value       JSONB       NOT NULL,
    updated_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_settings IS 'Global key/value settings editable only by admins; readable by all authenticated users.';

-- =============================================================================
-- 14. ANNOUNCEMENTS
-- Admin-authored messages shown in the application UI
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.announcements IS 'Admin-created announcements surfaced in the application UI.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- datasets
CREATE INDEX IF NOT EXISTS idx_datasets_owner_id    ON public.datasets (owner_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at  ON public.datasets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_upload_status ON public.datasets (upload_status);

-- dataset_versions
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_id  ON public.dataset_versions (dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_created_at  ON public.dataset_versions (created_at DESC);

-- analysis_runs
CREATE INDEX IF NOT EXISTS idx_analysis_runs_owner_id           ON public.analysis_runs (owner_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_dataset_version_id ON public.analysis_runs (dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_status             ON public.analysis_runs (status);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at         ON public.analysis_runs (created_at DESC);

-- transformation_steps
CREATE INDEX IF NOT EXISTS idx_transformation_steps_analysis_run_id ON public.transformation_steps (analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_transformation_steps_step_order      ON public.transformation_steps (analysis_run_id, step_order);

-- quality_checks
CREATE INDEX IF NOT EXISTS idx_quality_checks_dataset_version_id ON public.quality_checks (dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_created_at         ON public.quality_checks (created_at DESC);

-- analysis_metrics
CREATE INDEX IF NOT EXISTS idx_analysis_metrics_analysis_run_id ON public.analysis_metrics (analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_analysis_metrics_column_name     ON public.analysis_metrics (column_name);

-- reports
CREATE INDEX IF NOT EXISTS idx_reports_owner_id        ON public.reports (owner_id);
CREATE INDEX IF NOT EXISTS idx_reports_analysis_run_id ON public.reports (analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at      ON public.reports (created_at DESC);

-- exports
CREATE INDEX IF NOT EXISTS idx_exports_owner_id   ON public.exports (owner_id);
CREATE INDEX IF NOT EXISTS idx_exports_report_id  ON public.exports (report_id);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON public.exports (created_at DESC);

-- saved_recipes
CREATE INDEX IF NOT EXISTS idx_saved_recipes_owner_id   ON public.saved_recipes (owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_created_at ON public.saved_recipes (created_at DESC);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id    ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- admin_audit_logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id   ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically keeps updated_at in sync on every UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_datasets_updated_at
    BEFORE UPDATE ON public.datasets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_saved_recipes_updated_at
    BEFORE UPDATE ON public.saved_recipes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGN-UP
-- Triggered by new row insertion into auth.users (Supabase GoTrue)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, role, created_at, updated_at)
    VALUES (
        NEW.id,
        -- Derive a default username from the email local-part; caller can update later
        SPLIT_PART(NEW.email, '@', 1),
        -- Use full_name from raw_user_meta_data if provided (e.g., OAuth providers)
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        'user',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Attach the function to the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- HELPER: reusable inline function to check if current user is an admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- -----------------------------------------------------------------------------
-- profiles policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"   ON public.profiles;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile (but cannot change their own role)
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins have full read access to all profiles
CREATE POLICY "profiles_admin_all"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- datasets policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "datasets_owner_all"  ON public.datasets;
DROP POLICY IF EXISTS "datasets_admin_all"  ON public.datasets;

CREATE POLICY "datasets_owner_all"
    ON public.datasets FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "datasets_admin_all"
    ON public.datasets FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- dataset_versions policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "dataset_versions_owner_select" ON public.dataset_versions;
DROP POLICY IF EXISTS "dataset_versions_admin_all"    ON public.dataset_versions;

-- Users can read versions only for datasets they own
CREATE POLICY "dataset_versions_owner_select"
    ON public.dataset_versions FOR SELECT
    USING (
        dataset_id IN (
            SELECT id FROM public.datasets WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "dataset_versions_admin_all"
    ON public.dataset_versions FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- analysis_runs policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "analysis_runs_owner_all" ON public.analysis_runs;
DROP POLICY IF EXISTS "analysis_runs_admin_all" ON public.analysis_runs;

CREATE POLICY "analysis_runs_owner_all"
    ON public.analysis_runs FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "analysis_runs_admin_all"
    ON public.analysis_runs FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- transformation_steps policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "transformation_steps_owner_select" ON public.transformation_steps;
DROP POLICY IF EXISTS "transformation_steps_admin_all"    ON public.transformation_steps;

CREATE POLICY "transformation_steps_owner_select"
    ON public.transformation_steps FOR SELECT
    USING (
        analysis_run_id IN (
            SELECT id FROM public.analysis_runs WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "transformation_steps_admin_all"
    ON public.transformation_steps FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- quality_checks policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "quality_checks_owner_select" ON public.quality_checks;
DROP POLICY IF EXISTS "quality_checks_admin_all"    ON public.quality_checks;

CREATE POLICY "quality_checks_owner_select"
    ON public.quality_checks FOR SELECT
    USING (
        dataset_version_id IN (
            SELECT dv.id
            FROM public.dataset_versions dv
            JOIN public.datasets d ON d.id = dv.dataset_id
            WHERE d.owner_id = auth.uid()
        )
    );

CREATE POLICY "quality_checks_admin_all"
    ON public.quality_checks FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- analysis_metrics policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "analysis_metrics_owner_select" ON public.analysis_metrics;
DROP POLICY IF EXISTS "analysis_metrics_admin_all"    ON public.analysis_metrics;

CREATE POLICY "analysis_metrics_owner_select"
    ON public.analysis_metrics FOR SELECT
    USING (
        analysis_run_id IN (
            SELECT id FROM public.analysis_runs WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "analysis_metrics_admin_all"
    ON public.analysis_metrics FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- reports policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "reports_owner_all" ON public.reports;
DROP POLICY IF EXISTS "reports_admin_all" ON public.reports;

CREATE POLICY "reports_owner_all"
    ON public.reports FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "reports_admin_all"
    ON public.reports FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- exports policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "exports_owner_all" ON public.exports;
DROP POLICY IF EXISTS "exports_admin_all" ON public.exports;

CREATE POLICY "exports_owner_all"
    ON public.exports FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "exports_admin_all"
    ON public.exports FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- saved_recipes policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "saved_recipes_owner_all" ON public.saved_recipes;
DROP POLICY IF EXISTS "saved_recipes_admin_all" ON public.saved_recipes;

CREATE POLICY "saved_recipes_owner_all"
    ON public.saved_recipes FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "saved_recipes_admin_all"
    ON public.saved_recipes FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- activity_logs policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "activity_logs_owner_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_admin_all"    ON public.activity_logs;

-- Users can only read their own activity log entries
CREATE POLICY "activity_logs_owner_select"
    ON public.activity_logs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "activity_logs_admin_all"
    ON public.activity_logs FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- admin_audit_logs policies
-- Only admins can read; no one (including admins) can delete rows via the API
-- to maintain tamper-evidence. Inserts are done via SECURITY DEFINER functions.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_audit_logs_admin_select" ON public.admin_audit_logs;

CREATE POLICY "admin_audit_logs_admin_select"
    ON public.admin_audit_logs FOR SELECT
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- app_settings policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings_authenticated_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write"          ON public.app_settings;

-- All authenticated users can read settings
CREATE POLICY "app_settings_authenticated_select"
    ON public.app_settings FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert, update, or delete settings
CREATE POLICY "app_settings_admin_write"
    ON public.app_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- announcements policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_authenticated_select" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_all"            ON public.announcements;

-- All authenticated users can read active announcements
CREATE POLICY "announcements_authenticated_select"
    ON public.announcements FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins can manage all announcements (including inactive ones)
CREATE POLICY "announcements_admin_all"
    ON public.announcements FOR ALL
    USING (public.is_admin());

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
