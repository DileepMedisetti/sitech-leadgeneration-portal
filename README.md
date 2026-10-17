# Sitech Series Lead Generation Portal

Enterprise B2B SaaS platform for automated, highly-accurate academic and institutional contact discovery, evidence-based extraction, and lead qualification with strict SerpApi credit optimization and SSRF protection.

---

## 1. System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │      React 19 + Vite 8 SPA (pnpm)            │
                    │      Light-First Enterprise Design System     │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP / JSON API
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │         FastAPI Application Server           │
                    │   (CORS, Strict Validation, Lifecycle Mgt)   │
                    └──────┬───────────────┬───────────────┬───────┘
                           │               │               │
            ┌──────────────▼────┐   ┌──────▼────────┐  ┌───▼────────────────┐
            │ Search Execution  │   │ Lead Extract  │  │ Search Cache       │
            │ & Job Lifecycle   │   │ & Qualifier   │  │ & Query Planner    │
            └──────┬────────────┘   └──────┬────────┘  └───┬────────────────┘
                   │                       │               │
                   ▼                       ▼               ▼
            ┌──────────────────────────────────────────────────────────────┐
            │          PostgreSQL Database (SQLAlchemy 2.x)                │
            │  leads | search_jobs | search_results | search_query_cache   │
            └──────────────────────────────────────────────────────────────┘
```

### Key Modules:
- **`backend/app/services/extraction/`**: Modular extraction pipeline with 4 extraction strategies (`JsonLdStrategy`, `DirectoryTableStrategy`, `FacultyCardStrategy`, `IndividualProfileStrategy`), compound role inbox filter, academic name validation, and confidence-scoring evidence engine.
- **`backend/app/services/search_cache_service.py`**: Query hash deduplication engine preventing redundant SerpApi searches across jobs.
- **`backend/app/services/query_planner.py`**: Smart query plan generator targeting university faculty directories.
- **`backend/app/services/lead_extraction_service.py`**: SSRF-protected webpage fetcher with private/loopback IP blocking and retry policies.
- **`frontend/src/`**: Modern React 19 B2B dashboard with light-first warm palette, typed API client, real-time statistics, review queue, job lifecycle controls, and drawer-based lead inspection.

---

## 2. Tech Stack

- **Backend**: Python 3.11+, FastAPI 0.115+, SQLAlchemy 2.x, Alembic, Pydantic 2.x, HTTPX, BeautifulSoup4
- **Database**: PostgreSQL 15+ (`sitech_leadgeneration_db`)
- **Frontend**: React 19, Vite 8, Lucide React, vanilla CSS design tokens, pnpm
- **Testing**: Pytest, Pytest-AnyIO, Starlette TestClient

---

## 3. Prerequisites

- Python 3.11+
- Node.js 18+ and `pnpm` (install via `npm install -g pnpm` if needed)
- PostgreSQL 15+ running locally or remotely

---

## 4. Quick Start (Windows PowerShell)

### Step 1: Clone and Configure Environment

```powershell
# In project root:
Copy-Item .env.example .env
Copy-Item .env.example backend\.env
```

Edit `.env` (or `backend/.env`) with your PostgreSQL credentials:
```ini
DATABASE_URL=postgresql+psycopg2://postgres:your_password@localhost:5432/sitech_leadgeneration_db
SERPAPI_API_KEY=your_serpapi_api_key_here
```

### Step 2: Set Up Backend

```powershell
# Navigate to backend directory
cd backend

# Activate existing virtual environment (or create: python -m venv venv)
.\venv\Scripts\Activate.ps1

# Run database migrations to head
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be available at: `http://127.0.0.1:8000` (Interactive Swagger Docs: `http://127.0.0.1:8000/docs`).

### Step 3: Set Up Frontend

In a separate PowerShell terminal:
```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies with pnpm
pnpm install

# Start Vite development server
pnpm dev
```
Frontend portal will be live at: `http://localhost:5173`.

---

## 5. Running Automated Tests

Run the complete backend test suite (unit tests, integration tests, API contract tests, extraction correctness, credit optimization):

```powershell
# From project root:
backend\venv\Scripts\pytest.exe backend\tests -v
```

All 55 tests run completely isolated with zero live SerpApi calls and verified mock safety.

---

## 6. Building Frontend for Production

```powershell
cd frontend
pnpm build
```
Production assets are generated in `frontend/dist/`.

---

## 7. API Endpoints Inventory

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server and database health check |
| `GET` | `/api/dashboard/stats` | Aggregated portal KPIs and conversion metrics |
| `GET` | `/api/search-jobs` | List search jobs with status and progress |
| `POST` | `/api/search-jobs` | Create a new discovery & extraction job |
| `GET` | `/api/search-jobs/{id}` | Get detailed job statistics and configuration |
| `POST` | `/api/search-jobs/{id}/start` | Start executing a pending search job |
| `POST` | `/api/search-jobs/{id}/stop` | Pause / stop a running search job |
| `POST` | `/api/search-jobs/{id}/resume` | Resume a stopped search job |
| `GET` | `/api/search-jobs/{id}/results` | Paginated search results (URLs) for a job |
| `GET` | `/api/search-jobs/{id}/leads` | Leads discovered by a specific job |
| `POST` | `/api/search-jobs/{id}/collect` | Run URL discovery batch |
| `GET` | `/api/leads` | Paginated leads with multi-field search and filters |
| `POST` | `/api/leads` | Manually insert a lead |
| `GET` | `/api/leads/{id}` | Get full lead details including evidence provenance |
| `PATCH` | `/api/leads/{id}` | Update lead fields or qualification status |
| `GET` | `/api/leads/export` | Stream CSV export of qualified/filtered leads |
| `GET` | `/api/review-queue` | Retrieve leads flagged for manual review |
| `POST` | `/api/review-queue/{id}/approve` | Mark review-queue lead as qualified |
| `POST` | `/api/review-queue/{id}/reject` | Mark review-queue lead as rejected |
| `GET` | `/api/analytics` | Status breakdowns, confidence distribution, domain KPIs |
| `GET` | `/api/settings` | Safe configuration status (API key masked) |

---

## 8. Data Extraction & Credit Optimization Rules

1. **Zero SerpApi Costs for Extraction**: SerpApi is ONLY called during search discovery. Webpage contact extraction fetches stored HTML/URLs directly and consumes 0 SerpApi credits.
2. **Search Query Deduplication**: Queries are hashed (SHA-256) and cached in `search_query_cache`. Repeating the same query across jobs yields 0 credit burn.
3. **Compound Generic Inbox Filtering**: Rejects compound addresses like `helpdesk@`, `admissions@`, `career@`, `info@`, while preserving legitimate faculty emails.
4. **Header / UI Text Rejection**: Rejects false-positive names like *"Subscribe to our Newsletter"*, *"Software Development"*, *"Faculty Directory"*, *"Contact Us"*.
5. **Multi-Contact Association**: Accurately extracts multiple distinct faculty members from tables or card grids without cross-pollinating emails or overwriting IDs.
