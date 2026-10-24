# TableTell — Autonomous Agentic Business Intelligence Platform

<p align="center">
  <img src="frontend/public/tabletell-logo.png" alt="TableTell Logo" width="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>Autonomous AI Data Analyst & Deterministic Lakehouse Assistant</strong><br>
  <em>Turn raw datasets into explainable, mathematically verified business intelligence.</em>
</p>

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.13" /></a>
  <a href="https://duckdb.org/"><img src="https://img.shields.io/badge/DuckDB-1.1+-FFF000?style=for-the-badge&logo=duckdb&logoColor=black" alt="DuckDB" /></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://langchain-ai.github.io/langgraph/"><img src="https://img.shields.io/badge/LangGraph-0.2+-FF6F00?style=for-the-badge" alt="LangGraph" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.2+-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-8.3+-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
</p>

---

## ⚡ Why TableTell?

Traditional LLM analytics suffer from two major flaws: **mathematical hallucination** and **black-box data manipulation**.

TableTell eliminates both by coupling an **agentic LangGraph state machine** with a **deterministic in-process DuckDB columnar engine**:
1. **Zero Math Hallucination**: The LLM writes read-only SQL, but **100% of arithmetic, aggregations, and statistics execute directly in DuckDB's C++ vectorized engine**.
2. **Immutable Lakehouse Lineage**: Uploaded raw files are permanently stored in `data_lake/raw/`. Cleaning transformations never mutate source files—each cleaning cycle creates an audited, immutable Parquet version (`v1` $\rightarrow$ `v2` $\rightarrow$ `v3`).
3. **Autonomous Self-Healing**: If a query hits a DuckDB syntax or binder error, the LangGraph agent intercepts the traceback, dynamically repairs the SQL, and re-executes automatically.
4. **Real-Time Streaming & Instant Cancellation**: Progression milestones stream over Server-Sent Events (SSE). Queries can be cancelled instantly with zero zombie compute via client-side `AbortController` and backend disconnect detection.

---

## 🏛 System Architecture

```text
                                User Prompt / CSV Upload
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI API Service Layer                             │
│  /datasets  •  /datasets/{id}/rename  •  /clean  •  /chat/stream  •  /health   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Domain Engine Layer                                │
│   DatasetService      •       QualityService       •       CleaningService      │
└──────────────┬───────────────────────────────────────┬──────────────────────────┘
               │                                       │
               ▼                                       ▼
┌─────────────────────────────┐         ┌─────────────────────────────────────────┐
│     5-D Quality Engine      │         │          LangGraph State DAG            │
│  - Completeness  (25%)      │         │  1. Planning & Schema Digest            │
│  - Validity      (25%)      │         │  2. Generate Vectorized DuckDB SQL      │
│  - Consistency   (20%)      │         │  3. Execute via Read-Only Views         │
│  - Uniqueness    (15%)      │         │  4. Self-Healing Error Recovery (Loop)  │
│  - Anomaly Check (15%)      │         │  5. Plotly Spec & Markdown Synthesis    │
└─────────────────────────────┘         └────────────────────┬────────────────────┘
                                                             │
                                                             ▼
                                        ┌─────────────────────────────────────────┐
                                        │     DuckDB In-Memory Columnar Engine    │
                                        │     Zero-Copy Reads on Parquet Lake     │
                                        └────────────────────┬────────────────────┘
                                                             │
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Storage & Lineage Layer                                │
│  data_lake/raw/ (Source of Truth)  •  data_lake/processed/ (Parquet Lake)       │
│  metadata/tabletell_metadata.db (SQLite Full Audit Lineage & Execution Runs)    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Frontend Architecture
- **Framework**: [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 8](https://vitejs.dev/) with automated manual vendor code-splitting (`vendor-plotly`, `vendor-react`, `vendor-markdown`, `vendor-ui`) dropping initial bundle size by **98%** (86.4 kB initial load).
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom dark Nordic telemetry tokens and responsive glassmorphism.
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) with atomic selector hooks.
- **Visualizations**: [Plotly.js](https://plotly.com/javascript/) with custom responsive dark telemetry themes.
- **Streaming Client**: `@microsoft/fetch-event-source` wrapped in custom `useChatStream` with `AbortController` cancellation.
- **Component Resilience**: React `ErrorBoundary` and theme-aware Suspense loading skeletons on all views and chart widgets.

### Backend Architecture
- **API Runtime**: [FastAPI](https://fastapi.tiangolo.com/) with [Uvicorn](https://www.uvicorn.org/) ASGI server.
- **Analytics Database**: [DuckDB 1.1+](https://duckdb.org/) with in-memory execution catalogs and Parquet file scanning.
- **Agent Orchestrator**: [LangGraph](https://langchain-ai.github.io/langgraph/) state machines with conditional edge self-healing cycles.
- **LLM Synthesis**: [Google Gemini](https://ai.google.dev/) (`gemini-2.5-flash`) via `google-genai` and `langchain-google-genai`.
- **Metadata & Audit**: SQLite repository with strict foreign key constraints and transactional migration safety.
- **Data Lake Storage**: [PyArrow](https://arrow.apache.org/docs/python/) & [Pandas](https://pandas.pydata.org/) for atomic Parquet conversion.

### Production & Infrastructure
- **Containerization**: Multi-stage production [`Dockerfile`](./Dockerfile) serving Vite static distribution and FastAPI runtime.
- **Orchestration**: [`docker-compose.yml`](./docker-compose.yml) with host-mounted persistent storage volumes.
- **Reverse Proxy**: Preconfigured [`deploy/Caddyfile`](./deploy/Caddyfile) (automatic SSL) and [`deploy/nginx/tabletell.conf`](./deploy/nginx/tabletell.conf) with **zero-buffer SSE streaming optimizations** (`proxy_buffering off;`).

---

## ✨ Key Features

- **Data Catalog & Synchronization**: Upload CSV/Excel/Parquet files. Rename datasets on the fly with atomic synchronization across local Parquet files, SQLite lineage, and registered DuckDB catalog views.
- **5-Dimensional Data Health Scoring**: Deterministic quality evaluation across Completeness, Validity, Consistency, Uniqueness, and Anomaly frequency (scored 0–100%).
- **Interactive Studio**:
  - Contextual schema-adaptive suggested prompts.
  - Interactive Plotly visualizations (KPI cards, bar charts, time-series line plots, scatter plots).
  - Built-in Schema Inspector with live column distributions, null ratios, and data types.
  - Speech-to-text voice input transcription.
  - Dynamic **Run $\rightarrow$ Stop** button toggle with prompt recovery on cancel.
- **Production Observability**: Real-time `/api/health` system diagnostics endpoint monitoring SQLite integrity, DuckDB engine connectivity, and data lake disk usage.
- **System Audit Trail**: Complete log of all data transformations, approvals, run durations, and model provenance.

---

## 📂 Project Structure

```text
TableTell/
├── backend/
│   ├── app/
│   │   ├── agent/                 # LangGraph state machine, nodes, prompts
│   │   ├── analytics/             # SQL generator, validator, executor, Plotly synthesizer
│   │   ├── api/                   # FastAPI endpoints (datasets, chat, clean, health, audit)
│   │   ├── cleaning/              # Modular data transformers, planner, rules
│   │   ├── core/                  # Settings, exceptions, DuckDB connection pool
│   │   ├── ingestion/             # File parsing, schema inference, format detection
│   │   ├── profiling/             # Vectorized DuckDB profiling & distribution stats
│   │   ├── quality/               # 5-dimension health engine & audit rules
│   │   ├── schemas/               # Pydantic v2 validation models
│   │   ├── services/              # Dataset, Quality, Cleaning, Assistant services
│   │   ├── storage/               # ParquetStore lake manager, SQLite MetadataRepository
│   │   └── main.py                # FastAPI entrypoint with production SPA static fallback
│   ├── tests/
│   │   ├── fixtures/              # Deterministic dirty test datasets
│   │   └── unit/                  # 49 automated unit tests
│   ├── requirements.txt
│   └── run.py                     # Configurable host/port launcher
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Studio, Datasets, Audit, Telemetry, Common UI
│   │   ├── hooks/                 # useChatStream (SSE + AbortController)
│   │   ├── lib/                   # API client, Plotly theme
│   │   ├── store/                 # Zustand app store, toast notifications
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx                # Lazy-loaded views with Suspense skeletons
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts             # Manual vendor chunking & Tailwind CSS v4
│
├── deploy/
│   ├── nginx/tabletell.conf       # Nginx server block with SSE proxy_buffering off
│   ├── Caddyfile                  # Caddyfile with automatic SSL & zero-buffer flush
│   ├── tabletell.service          # Linux systemd service unit file
│   └── .env.production.example    # Production environment variable template
│
├── Dockerfile                     # Multi-stage production container build
├── docker-compose.yml             # Single-command VPS orchestration
├── DEPLOYMENT.md                  # Comprehensive VPS hosting handbook
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.13+**
- **Node.js 20+**
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### Local Development Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY in .env

python run.py
```
*Backend API and Swagger docs live at `http://localhost:8000/docs`.*

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend workspace live at `http://localhost:5173`.*

---

## 🐳 Production Deployment (VPS / Docker)

TableTell includes a turnkey production deployment configuration for VPS hosting (DigitalOcean, Hetzner, AWS EC2, Linode).

```bash
# 1. Clone repository on your VPS
git clone https://github.com/sslenn/TableTell.git /opt/tabletell
cd /opt/tabletell

# 2. Configure production secrets
cp deploy/.env.production.example .env
nano .env   # Set your GEMINI_API_KEY

# 3. Start container with persistent data volume
docker compose up -d --build

# 4. Verify deployment health
curl http://localhost:8000/api/health
```

For complete instructions on configuring **Nginx**, **Caddy with automatic SSL**, or **Systemd**, see the [**`DEPLOYMENT.md` Guide**](./DEPLOYMENT.md).

---

## 🧪 Testing & Verification

TableTell maintains a rigorous test suite of **49 automated unit tests** covering ingestion, profiling, cleaning, SQL safety, dataset renaming, chat streaming, and system health checks:

```bash
# Run complete test suite
cd backend
python -m unittest discover tests/unit
```

Output:
```text
Ran 49 tests in 13.289s
OK
```

Validate frontend TypeScript types and build bundle:
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
