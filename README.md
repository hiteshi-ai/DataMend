# DataMend — Prompt-Driven Data Cleaning & Quality Analysis Platform

**DataMend** is a production-grade, full-stack analytical web platform built from scratch. It empowers users to upload real datasets (CSV, Excel, JSON), express data transformation objectives in natural language, review and approve transparent plans, inspect statistical measures, create interactive Plotly visualizations, compare historical iterations, and export genuine reports and reproducible Python code.

---

## 1. Key Features

- **Prompt-Driven Transformation Lab**: Type instructions in plain English or Hindi. A hybrid interpreter (deterministic rules + optional OpenAI integration) generates a validated plan showing affected columns, assumptions, and potential data-loss warnings.
- **Two Role-Protected Portals**:
  - **Portal A: User Portal** (Strictly 5 primary navigation sections):
    1. *How to Use* — Interactive guided tour, bilingual tutorials, troubleshooting, and FAQs.
    2. *My Workspace* — Persistent datasets, analysis history, saved reports, and quick actions.
    3. *Data Lab* — File upload, inspection table (first 50 rows), Prompt Lab, execution engine, and transformation ledger.
    4. *Insights & Compare* — Descriptive statistics (mean, median, mode, IQR, skewness, kurtosis), interactive Plotly charts, and side-by-side comparison.
    5. *Reports & Exports* — Persistent reports with genuine downloadable exports (PDF, HTML, CSV, XLSX, JSON, and Python scripts).
  - **Portal B: Admin Portal**:
    - Restricted login (`/admin/login`) with server-side role verification.
    - Initial credentials (`admin` / `admin@123`) with mandatory password change on first login.
    - Live platform overview, user management (suspend, reactivate, delete), processing telemetry, storage breakdown, system configuration, and audit logs.
- **Four Visual Themes**:
  1. *Lavender Mist* (`#F4F0FF`, Accent: `#8B79C6`, Text: `#29243B`)
  2. *Blush Pink* (`#FFF1F5`, Accent: `#C76F91`, Text: `#432C36`)
  3. *Sage Green* (`#F1F7F0`, Accent: `#648B68`, Text: `#26382B`)
  4. *Midnight Navy* (`#101B35`, Accent: `#9AB7FF`, Text: `#F3F6FF`)
- **Bilingual Multilingual Support**: Instant toggle between English (`en`) and Hindi (`hi`) across all navigation items, cards, forms, dialogs, empty states, and explanations.
- **Zero Fabrication Guarantee**: All metrics, missing counts, duplicate counts, outlier flags, and chart points reflect genuine uploaded data and executed Pandas/SciPy operations.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Plotly.js (`react-plotly.js`), Zustand, i18next, Lucide React, React Hot Toast.
- **Backend**: Python 3.11+ / 3.12+, FastAPI, Uvicorn, Pandas, NumPy, SciPy, ReportLab, Pydantic, Passlib (bcrypt).
- **Database & Storage**: Supabase PostgreSQL with Row Level Security (RLS) policies and private Supabase Storage buckets.

---

## 3. Project Directory Structure

```
DataMend/
├── .env.example                  # Environment configuration template
├── README.md                     # Comprehensive project documentation
├── backend/                      # Python FastAPI application
│   ├── config.py                 # Pydantic environment configuration
│   ├── database.py               # Supabase clients & JWT auth verification
│   ├── main.py                   # FastAPI application & router mounting
│   ├── requirements.txt          # Python dependencies
│   ├── admin/                    # Admin portal endpoints
│   ├── auth/                     # User & admin authentication
│   ├── datasets/                 # Ingestion & versioning
│   ├── insights/                 # Statistics, Plotly specs & comparisons
│   ├── processing/               # Operations, NLP interpreter & quality profiles
│   ├── reports/                  # Report persistence & genuine file exports
│   └── storage/                  # Supabase object storage service
├── database/                     # Database migrations & seeds
│   ├── schema.sql                # 14 PostgreSQL tables with indexes & RLS
│   └── seed.sql                  # Default system settings & admin bootstrap
├── docs/                         # Technical documentation
│   ├── ARCHITECTURE.md           # Architecture, dataflow & security model
│   └── API_REFERENCE.md          # Complete REST API specification
├── frontend/                     # React TypeScript frontend
│   ├── package.json              # NPM dependencies & build scripts
│   ├── tailwind.config.js        # Theme color variables & styling
│   ├── vite.config.ts            # Vite bundler configuration
│   └── src/
│       ├── App.tsx               # Route declarations & auth guards
│       ├── components/           # Reusable UI & portal layouts
│       ├── i18n/                 # Bilingual translations (en.json, hi.json)
│       ├── lib/                  # Axios API client & Supabase client
│       ├── pages/                # Pages for the 5 user sections & admin
│       ├── store/                # Zustand auth & theme stores
│       └── types/                # TypeScript type definitions
└── tests/                        # Automated unit and integration tests
    ├── run_all.py                # Test suite runner
    ├── test_nlp_interpreter.py   # NLP prompt rule interpreter tests
    ├── test_operations.py        # Core Pandas data cleaning operations tests
    └── test_quality.py           # Quality profile computation & diff tests
```

---

## 4. Prerequisites & Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- A free Supabase project ([supabase.com](https://supabase.com))

### Step 1: Clone or Open Project
```bash
cd DataMend
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
JWT_SECRET=your-supabase-jwt-secret
OPENAI_API_KEY=optional_openai_key
ALLOW_ADMIN_INIT=true
```

In `frontend/`, copy `.env.example` to `.env.local`:
```bash
cd frontend
cp .env.example .env.local
```
Provide the frontend values:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

### Step 3: Database Migrations
1. Open your Supabase Dashboard → **SQL Editor**.
2. Run the SQL script located at `database/schema.sql`. This creates all 14 tables, triggers, indexes, and Row Level Security policies.
3. Run the SQL script located at `database/seed.sql`. This populates initial application settings.
4. Go to **Storage** in the Supabase Dashboard and ensure a private bucket named `datasets` exists.

### Step 4: Admin Account Initialization
The initial administrator credentials are:
- **Username**: `admin`
- **Initial Password**: `admin@123`

To bootstrap this account securely:
1. Ensure `ALLOW_ADMIN_INIT=true` in your backend `.env`.
2. Send a request to `POST http://localhost:8000/api/auth/admin/initialize` or use the Admin Login screen.
3. Sign in at `http://localhost:5173/admin/login`.
4. You will be prompted to change the initial password immediately before gaining access.
5. In production, set `ALLOW_ADMIN_INIT=false`.

### Step 5: Start the Backend
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API docs will be available at `http://localhost:8000/docs`.

### Step 6: Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The application will be live at `http://localhost:5173`.

---

## 5. Running Automated Tests

DataMend includes an automated Python test suite verifying operations, NLP translation, and quality profiling:
```bash
python tests/run_all.py
```
Output:
```
==================================================
           DATAMEND AUTOMATED TEST SUITE          
==================================================

>> Executing: test_operations.py ...
[PASS] test_operations.py

>> Executing: test_nlp_interpreter.py ...
[PASS] test_nlp_interpreter.py

>> Executing: test_quality.py ...
[PASS] test_quality.py

--------------------------------------------------
Total: 3 | Passed: 3 | Failed: 0
--------------------------------------------------
ALL TESTS COMPLETED SUCCESSFULLY!
```

To build and verify the frontend bundle:
```bash
cd frontend
npm run build
```

---

## 6. How to Push to GitHub or Export Source Code

### Option A: Push to GitHub via Git CLI
1. Initialize a Git repository (if not already initialized):
   ```bash
   git init
   git add .
   git commit -m "feat: complete DataMend full-stack analytical web platform"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Set the remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/datamend.git
   git branch -M main
   git push -u origin main
   ```

### Option B: Download Full Source Code as ZIP
1. In PowerShell:
   ```powershell
   Compress-Archive -Path "C:\Users\hites\OneDrive\Desktop\DataMend\*" -DestinationPath "C:\Users\hites\OneDrive\Desktop\DataMend_Source.zip"
   ```
2. The entire source code archive `DataMend_Source.zip` will be ready for extraction or uploading.

---

## 7. Security & Privacy Highlights

- **Row Level Security (RLS)**: Enforced directly in PostgreSQL so users cannot query or mutate data belonging to other accounts.
- **Private Storage**: Datasets are never publicly accessible via direct URLs. Access is mediated by server-side verification and short-lived signed URLs.
- **Admin Verification**: Role checks (`role === 'admin'`) occur strictly on the backend. Client-side state cannot grant administrative permissions.
- **Tamper-Evident Audit Logging**: Administrative interventions (suspensions, setting modifications, deletions) are recorded with timestamps, actor IDs, and action metadata.
