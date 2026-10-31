# DataMend Architecture & Design Document

## 1. System Overview

**DataMend** is a production-oriented, full-stack analytical web platform engineered for prompt-driven data cleaning, data quality assessment, exploratory data analysis (EDA), interactive visualization, and reproducible historical comparison.

```mermaid
flowchart TD
    User([User / Browser])
    Admin([Administrator])

    subgraph Frontend [React 18 + TypeScript + Tailwind CSS]
        UI[User Portal - 5 Sections]
        AUI[Admin Portal]
        State[Zustand Stores]
        i18n[i18next Multilingual EN/HI]
        Plotly[Plotly.js Visualizations]
    end

    subgraph Backend [FastAPI Application]
        AuthRouter[/api/auth]
        DataRouter[/api/datasets]
        ProcRouter[/api/processing]
        InsightRouter[/api/insights]
        ReportRouter[/api/reports]
        AdminRouter[/api/admin]

        NLP[Rule-Based / OpenAI NLP Interpreter]
        Engine[Pandas & SciPy Engine]
    end

    subgraph Supabase [Persistent Cloud Infrastructure]
        PG[(PostgreSQL + RLS)]
        Storage[(Private Object Storage Buckets)]
        AuthService[Supabase Auth Engine]
    end

    User --> UI
    Admin --> AUI
    UI --> Backend
    AUI --> Backend
    Backend --> PG
    Backend --> Storage
    Backend --> AuthService
```

---

## 2. Portals & Role Separation

### Portal A: User Portal
- **Five Primary Sections Only**:
  1. **How to Use**: Beginner-friendly onboarding learning center with interactive guided tours, illustrated steps, bilingual Hindi/English explanations, and FAQs.
  2. **My Workspace**: Personalized dashboard displaying real datasets, analysis history, saved reports, dataset library, and quick actions.
  3. **Data Lab**: Core processing lab for uploading CSV, Excel, and JSON datasets; prompt-driven transformation lab with verified structured plan generation, user approval workflows, and an immutable ledger.
  4. **Insights & Compare**: Descriptive statistics (mean, median, mode, IQR, skewness, kurtosis), interactive Plotly figures (histograms, bar charts, scatter plots, box plots, heatmaps), and side-by-side historical comparison.
  5. **Reports & Exports**: Automatically generated analysis reports with genuine downloads (PDF, HTML, cleaned CSV, cleaned XLSX, cleaned JSON, and reproducible Python scripts).

### Portal B: Admin Portal
- Distinct login page (`/admin/login`) requiring server-side verified `admin` role.
- No public self-registration for administrator privileges.
- First login enforces password change from default `admin@123`.
- 6 Key Administrative Modules:
  1. **Platform Overview**: Live real-time statistics (total users, 7d/30d active users, datasets, analysis runs, success/failure counts, and storage usage).
  2. **User Management**: Search, filter, view metadata, suspend, reactivate, and delete users (with required `CONFIRM_DELETE` token).
  3. **Analysis & Job Monitoring**: Execution duration tracking, error logs, and operational telemetry.
  4. **Storage & Data Management**: Storage telemetry by format and count.
  5. **System Configuration**: Upload size limits, maximum row limits, announcements, and AI provider configurations.
  6. **Audit Log**: Tamper-evident ledger of administrative sign-ins, suspensions, settings updates, and deletions.

---

## 3. Data Processing & Safety Guarantees

1. **Non-Destructive Versioning**: Original uploaded datasets are stored in private storage as version 1 (`is_original = true`). Cleaned outputs are written as new versioned artifacts (v2, v3, etc.).
2. **Deterministic Predefined Operations**: Arbitrary AI-generated Python code is never directly executed. Natural language prompts are translated into validated, structured operation plans (`remove_duplicates`, `fill_missing`, `convert_dtype`, `trim_whitespace`, `filter_rows`, etc.).
3. **Reproducibility**: Analysis runs generate a standalone Python script utilizing standard Pandas operations, allowing users to execute the exact cleaning pipeline independently in their own environments.

