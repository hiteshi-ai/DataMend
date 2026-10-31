# DataMend REST API Specification

Base URL: `http://localhost:8000` (or configured backend URL)

All authenticated endpoints require an `Authorization: Bearer <token>` header.

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Authenticate user, returns JWT & user profile | No |
| POST | `/api/auth/logout` | Invalidate current session | Yes |
| GET | `/api/auth/me` | Fetch active user profile and preferences | Yes |
| PUT | `/api/auth/profile` | Update display name, theme, or language | Yes |
| POST | `/api/auth/admin/login` | Privileged admin login | No |
| POST | `/api/auth/admin/change-password` | Change admin password (required on first login) | Yes (Admin) |

---

## 2. Datasets (`/api/datasets`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/datasets/upload` | Upload CSV, Excel, or JSON dataset multipart file | Yes |
| GET | `/api/datasets` | List authenticated user's datasets (filterable) | Yes |
| GET | `/api/datasets/{id}` | Retrieve specific dataset metadata | Yes |
| DELETE | `/api/datasets/{id}` | Delete dataset and all versioned artifacts | Yes |
| GET | `/api/datasets/{id}/versions` | List all immutable versions of a dataset | Yes |
| GET | `/api/datasets/{id}/versions/{version_id}/preview` | Preview first 50 rows and quality metrics | Yes |
| GET | `/api/datasets/{id}/versions/{version_id}/download` | Generate secure signed download URL | Yes |
| POST | `/api/datasets/{id}/profile` | Generate comprehensive data quality profile | Yes |

---

## 3. Processing (`/api/processing`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/processing/interpret` | Interpret natural-language prompt into structured plan | Yes |
| POST | `/api/processing/execute` | Execute approved cleaning plan and produce new version | Yes |
| GET | `/api/processing/runs` | List user's analysis runs | Yes |
| GET | `/api/processing/runs/{id}` | Inspect run metadata and transformation steps | Yes |
| GET | `/api/processing/runs/{id}/status` | Check live execution status | Yes |
| GET | `/api/processing/runs/{id}/script` | Generate reproducible Python script | Yes |
| POST | `/api/processing/recipes` | Save cleaning pipeline as reusable recipe | Yes |
| GET | `/api/processing/recipes` | List user's saved recipes | Yes |
| POST | `/api/processing/recipes/{id}/apply` | Apply saved recipe to a dataset version | Yes |

---

## 4. Insights & Compare (`/api/insights`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/insights/statistics` | Compute descriptive statistics for all columns | Yes |
| POST | `/api/insights/correlation` | Calculate Pearson correlation matrix for numeric fields | Yes |
| POST | `/api/insights/chart` | Return Plotly figure specification for chosen parameters | Yes |
| POST | `/api/insights/compare` | Compare two dataset versions or analysis runs side-by-side | Yes |
| GET | `/api/insights/recommendations` | Suggest optimal visualizations based on inferred data types | Yes |

---

## 5. Reports & Exports (`/api/reports`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/api/reports` | List persistent analysis reports | Yes |
| GET | `/api/reports/{id}` | Get report summary and metrics | Yes |
| POST | `/api/reports/{id}/export/pdf` | Download genuine PDF report (ReportLab generated) | Yes |
| POST | `/api/reports/{id}/export/html` | Download genuine standalone HTML report | Yes |
| POST | `/api/reports/{id}/export/csv` | Download cleaned dataset as CSV | Yes |
| POST | `/api/reports/{id}/export/xlsx` | Download cleaned dataset as Excel XLSX | Yes |
| POST | `/api/reports/{id}/export/json` | Download cleaned dataset as JSON | Yes |
| POST | `/api/reports/{id}/export/python` | Download reproducible Python script | Yes |

---

## 6. Administration (`/api/admin`)

*All endpoints in this section strictly require verified administrator privileges.*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Live platform metrics (users, runs, datasets, storage) |
| GET | `/api/admin/users` | List registered accounts with activity counters |
| PUT | `/api/admin/users/{id}/suspend` | Suspend user access |
| PUT | `/api/admin/users/{id}/reactivate` | Reactivate user account |
| DELETE | `/api/admin/users/{id}` | Permanently delete user and data (`CONFIRM_DELETE`) |
| GET | `/api/admin/runs` | Inspect all platform analysis executions |
| GET | `/api/admin/runs/{id}` | View job logs and step-level metadata |
| GET | `/api/admin/storage` | Storage telemetry by file format and volume |
| GET | `/api/admin/settings` | Read global system configuration |
| PUT | `/api/admin/settings` | Update system limits and policies |
| GET | `/api/admin/audit-logs` | Retrieve immutable audit log entries |
| POST | `/api/admin/announcements` | Publish broadcast announcement |
