# TableTell — Autonomous Agentic Business Intelligence (Agentic BI) Platform

[![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-1.5+-FFF000?style=for-the-badge&logo=duckdb&logoColor=black)](https://duckdb.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.143+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2+-FF6F00?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)
[![React 19](https://img.shields.io/badge/React-19.2+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

> **TableTell turns messy business datasets into verified, explainable business intelligence.**  
> Upload raw CSVs, preserve immutable sources, profile quality deterministically, approve explainable cleaning plans, and execute analytical questions via DuckDB and LangGraph.

---

## Architecture Overview

```text
User Question / CSV Upload
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI API Layer                       │
│  /datasets  •  /datasets/upload  •  /clean  •  /chat/stream │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Domain Services Layer                    │
│   DatasetService  •  QualityService  •  CleaningService     │
└──────┬──────────────────────┬───────────────────────────────┘
       │                      │
       ▼                      ▼
┌─────────────────────┐  ┌────────────────────────────────────┐
│   Quality Engine    │  │       LangGraph State Agent        │
│ 5 Dimensions:       │  │ Planning -> SQL Gen -> Execution   │
│ - Completeness (25%)│  │ -> Self-Healing -> Visualization   │
│ - Validity (25%)    │  └─────────────────┬──────────────────┘
│ - Consistency (20%) │                    │
│ - Uniqueness (15%)  │                    ▼
│ - Anomaly (15%)     │  ┌────────────────────────────────────┐
└─────────────────────┘  │   DuckDB Vectorized Query Engine   │
                         │   Sandboxed Read-Only Views        │
                         └─────────────────┬──────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage & Metadata Layer                  │
│ data_lake/raw/ (Immutable) • data_lake/processed/ (Versions)│
│ metadata/tabletell_metadata.db (SQLite Lineage & Audit Log) │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Guarantees & Features

1. **Immutable Raw Data Preservation:** Uploaded CSV/Excel files are saved permanently in `data_lake/raw/`. Transformations never overwrite or mutate raw sources.
2. **Transparent Multi-Dimensional Health Scoring:** Evaluates dataset health across 5 configurable dimensions: Completeness (25%), Validity (25%), Consistency (20%), Uniqueness (15%), and Anomaly Review (15%).
3. **Approval-Based Cleaning & Versioning:** Quality issues generate structured proposals (Rule ID, affected rows, evidence, action, risk). Executing approved transformations creates a new version (`v1` -> `v2` -> `v3`) with full before-and-after audit statistics.
4. **SQL Safety & Zero Math Hallucination:** 100% of arithmetic runs in DuckDB C++ columnar engine. Queries are restricted to read-only `SELECT`/`WITH` statements and run against isolated registered views.
5. **Autonomous Error Self-Healing:** DuckDB syntax or binder errors are intercepted by LangGraph and repaired autonomously up to 2 retries.
6. **Smart Visualization Synthesis:** Formats Plotly charts dynamically based on query dimensions: temporal line charts for date trends, bar charts for categorical breakdowns, scatter plots for metric correlations, and KPI indicator cards for scalars.
7. **Complete Audit Lineage:** SQLite metadata repository tracks dataset versions, cleaning proposals, user approvals, execution durations, and run histories.

---

## Project Structure

```text
TableTell/
├── backend/
│   ├── app/
│   │   ├── agent/                 # LangGraph state machine, nodes, prompts
│   │   ├── analytics/             # SQL generator, validator, executor, visualization
│   │   ├── api/                   # FastAPI endpoints (datasets, upload, cleaning, chat, audit)
│   │   ├── cleaning/              # Modular transformers, planner, validation
│   │   ├── core/                  # Settings, exceptions, DuckDB adapter
│   │   ├── ingestion/             # CSV reader, schema inference, validation
│   │   ├── profiling/             # Vectorized DuckDB profiler, column stats
│   │   ├── quality/               # Rules engine, 5-dim scoring, recommendations
│   │   ├── schemas/               # Pydantic v2 request/response schemas
│   │   ├── services/              # Dataset, Quality, Cleaning, Analytics services
│   │   ├── storage/               # ParquetStore, SQLite MetadataRepository
│   │   └── main.py                # FastAPI entry point
│   ├── data_lake/
│   │   ├── raw/                   # Immutable uploaded CSV files
│   │   ├── processed/             # Versioned Parquet files (e.g. data_v1.parquet)
│   │   └── metadata/              # SQLite database (tabletell_metadata.db)
│   ├── tests/
│   │   ├── fixtures/              # Deterministic test datasets with known defects
│   │   ├── unit/                  # Unit tests (ingestion, quality, cleaning, sql)
│   │   ├── integration/           # End-to-end integration pipeline tests
│   │   └── benchmark_pipeline.py  # 10,000-row latency benchmark script
│   ├── requirements.txt
│   ├── run.py                     # Backend server launcher
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Studio, Datasets, Audit, Telemetry views
│   │   ├── hooks/                 # SSE chat streaming hook
│   │   ├── lib/                   # API client, Plotly theme
│   │   ├── store/                 # Zustand global state store
│   │   ├── types/                 # TypeScript API & dataset types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── DESIGN.md                      # Nordic Terminal design system specification
├── frontend.md                    # Frontend architecture specification
└── README.md
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/datasets/upload` | Upload CSV/Excel/Parquet, preserve raw copy, generate version 1 Parquet |
| `GET` | `/api/datasets` | List all catalog datasets with cached health scores and row counts |
| `GET` | `/api/datasets/{id}` | Get dataset details, current version, and version history |
| `GET` | `/api/datasets/{id}/preview` | Preview top rows of dataset version |
| `GET` | `/api/datasets/{id}/audit` | Comprehensive 5-dimension quality audit & column profile |
| `GET` | `/api/datasets/{id}/versions` | List all historical versions and changelogs |
| `POST` | `/api/datasets/{id}/cleaning-plans` | Generate explainable proposals for user review |
| `POST` | `/api/datasets/{id}/cleaning-runs` | Execute approved transformations, creating version N+1 |
| `POST` | `/api/datasets/{id}/clean` | Execute default auto-cleaning (backward compatible) |
| `POST` | `/api/chat` | Synchronous natural language analytical query |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) streaming with live self-healing trace |
| `POST` | `/api/analytics/query` | Direct analytical query endpoint |
| `GET` | `/api/analytics/runs` | List analytical query execution traces |
| `GET` | `/api/audit` | System-wide audit log of all entity actions |
| `GET` | `/api/health` | Service health status |

---

## Verification & Commands

### 1. Run Automated Tests
```powershell
# From TableTell/backend
.\.venv\Scripts\python.exe -m unittest discover -s tests
```
*Executes all 25 unit and integration tests across ingestion, quality scoring, cleaning, SQL validation, and end-to-end pipeline.*

### 2. Run Latency Benchmarks
```powershell
# From TableTell/backend
.\.venv\Scripts\python.exe .\tests\benchmark_pipeline.py
```
*Benchmarks 10,000-row ingestion, profiling, cleaning, DuckDB aggregation, and Plotly visualization.*

### 3. Start Backend Server
```powershell
# From TableTell/backend
.\.venv\Scripts\python.exe run.py
```
*FastAPI interactive docs live at `http://localhost:8000/docs`.*

### 4. Build & Lint Frontend
```powershell
# From TableTell/frontend
npm run build
npm run lint
```

### 5. Start Frontend Dev Server
```powershell
# From TableTell/frontend
npm run dev
```
*Frontend workspace live at `http://localhost:5173`.*
