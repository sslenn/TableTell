# TableTell — Frontend Architecture & Implementation Plan (`frontend.md`)

## Executive Summary & Engineering Review

TableTell is evolving from an interim Streamlit prototype into a high-performance, decoupled **React 19 + TypeScript + Vite** Single Page Application (SPA). This document formalizes the engineering plan, architectural contracts, component hierarchy, page breakdowns, and technology decisions.

All design decisions strictly adhere to **The Nordic Terminal (Nordic Teal)** design system specified in [`DESIGN.md`](file:///D:/flagship%20project/Hobby%20Projects/TableTell/DESIGN.md).

---

## 1. Technology Stack Lock

| Domain | Technology Selected | Rationale & Trade-offs |
| :--- | :--- | :--- |
| **Runtime & Core** | **React 19.x + TypeScript 5.8+** | Already scaffolded in `/frontend`. React 19 actions, compiler optimizations, and robust concurrent rendering. |
| **Bundler & Tooling** | **Vite 6.x** | Sub-50ms HMR, native ES module support, optimized Rollup production builds. |
| **Styling Architecture** | **Tailwind CSS v4 + PostCSS** | Zero-runtime CSS custom property integration matching `:root` Nordic Teal tokens (`--tt-*`). |
| **Component Primitives** | **Radix UI Primitives** | Unstyled, accessible (WAI-ARIA compliant) building blocks for dialogs, dropdowns, popovers, and tabs. |
| **Iconography** | **Lucide React (`lucide-react`)** | Clean, technical, geometric vector icons. Eliminates platform emoji inconsistencies. |
| **Interactive Visualizations** | **Plotly.js (`plotly.js-dist-min` + `react-plotly.js`)** | Direct compatibility with backend LangGraph `plotly_spec` JSON outputs. Transparent canvas with theme-adaptive ramps. |
| **High-Density Data Grids** | **TanStack Table v8 (`@tanstack/react-table`)** | Headless tabular processing with virtualized scrolling, column resizing, sorting, and strict `tabular-nums` alignment. |
| **State Management** | **Zustand (`zustand`)** | Minimalist 1KB state store with zero boilerplate, supporting localStorage persistence for dataset selection, chat history, and theme mode. |
| **Real-Time Streaming** | **`@microsoft/fetch-event-source`** | Resilient Server-Sent Events (SSE) client for consuming FastAPI `/api/chat/stream` with POST body support and error recovery. |
| **Syntax Highlighting** | **PrismJS / `react-syntax-highlighter`** | High-performance SQL syntax display for generated DuckDB queries and self-healing diffs. |

---

## 2. Information Architecture & Page Structure

TableTell provides an uncluttered workspace split into 4 core functional views:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  GLOBAL SHELL: T-DAG SVG Logo · Dataset Picker · Telemetry Indicator · Theme Switcher  │
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│              │ 1. Analytical Studio (/)                                                │
│              │    - Command Dock (NL Query Input, Preset Chips, Audio Transcription)   │
│              │    - Agent Telemetry Rail (Plan -> SQL -> Self-Heal -> Plotly)          │
│   SIDEBAR    │    - Interactive Visual Canvas (Plotly Charts)                          │
│  NAVIGATION  │    - Columnar Results Grid (TanStack Table with Decimal Alignment)      │
│              ├─────────────────────────────────────────────────────────────────────────┤
│  • Studio    │ 2. Data Lake & Catalog (/datasets)                                      │
│  • Datasets  │    - Parquet File Lake Table (Rows, Cols, Memory Footprint, Health Score) │
│  • Audit     │    - Drag-and-Drop Ingestion (CSV, XLSX, Parquet)                        │
│  • Telemetry │    - 1-Click OOP Data Cleaning Pipeline Trigger                         │
│              ├─────────────────────────────────────────────────────────────────────────┤
│              │ 3. Data Quality & Audit (/audit)                                        │
│              │    - 100/100 Health Score Card & Missing Value Matrix                   │
│              │    - Column Distribution & Cardinality Profiler                         │
│              ├─────────────────────────────────────────────────────────────────────────┤
│              │ 4. LangGraph DAG Telemetry (/telemetry)                                 │
│              │    - State Graph Execution Visualizer                                   │
│              │    - Self-Healing Audit Trail & Syntax Error Recovery History           │
└──────────────┴─────────────────────────────────────────────────────────────────────────┘
```

### View 1: Analytical Studio (`/`)
* **Purpose:** The primary human-AI analytical pair-programming workspace.
* **Key Components:**
  * `CommandDock`: Form input with query textarea, speech-to-text trigger, dataset context badge, and submit button.
  * `AgentTelemetryRail`: Step indicators showing LangGraph execution (`Planning` $\rightarrow$ `Generating SQL` $\rightarrow$ `DuckDB Running` $\rightarrow$ `Visualizing`), execution latencies, and self-healing badges.
  * `ChartCanvas`: Responsive Plotly container dynamically adapting to dark/light surfaces with categorical colorway ramps.
  * `DataGridInspector`: High-density TanStack table with column type labels (`VARCHAR`, `DOUBLE`, `TIMESTAMP`), search filter, and CSV/Parquet export.
  * `SqlModal`: Collapsible drawer showing raw executed DuckDB SQL with syntax highlighting and copy button.

### View 2: Data Lake & Catalog (`/datasets`)
* **Purpose:** Ingestion and management of local Parquet datasets.
* **Key Components:**
  * `DatasetTable`: Lists datasets from `GET /datasets` with row counts, column counts, file size on disk, and health scores.
  * `DropzoneUploader`: Drag-and-drop zone sending multipart form uploads to `POST /datasets/upload`.
  * `CleanTriggerButton`: Executes `POST /datasets/{id}/clean` with interactive before-and-after audit logs.

### View 3: Data Quality & Profiling (`/audit`)
* **Purpose:** Deep diagnostic breakdown of the active dataset.
* **Key Components:**
  * `HealthScoreGauge`: Visual quality score (0–100) based on null ratios, duplicate rates, and type validity.
  * `ColumnProfileGrid`: Cards per column showing distinct count, null count, min/max values, and sample distribution.
  * `AuditHistoryLog`: Historical log of transformations performed by `cleaning_pipeline`.

### View 4: LangGraph DAG Telemetry (`/telemetry`)
* **Purpose:** Complete transparency into autonomous agent decision-making.
* **Key Components:**
  * `DagNodeGraph`: Node graph displaying LangGraph steps: `plan` $\rightarrow$ `generate_sql` $\rightarrow$ `execute_sql` $\rightarrow$ `self_heal` $\rightarrow$ `visualize`.
  * `ErrorRecoveryTimeline`: Highlights intercepted syntax errors, DuckDB tracebacks, and automatic repair iterations.

---

## 3. Design System & CSS Token Architecture (Nordic Teal)

The frontend integrates the tokens from [`DESIGN.md`](file:///D:/flagship%20project/Hobby%20Projects/TableTell/DESIGN.md) via Tailwind CSS and CSS Custom Properties:

```css
/* src/index.css */
@import "tailwindcss";

@layer base {
  :root[data-theme="dark"] {
    --tt-bg-canvas: #0A1214;
    --tt-bg-surface: #112022;
    --tt-bg-elevated: #182F32;
    --tt-bg-sunken: #060B0C;
    --tt-text-primary: #F0FDFA;
    --tt-text-secondary: #99F6E4;
    --tt-text-muted: #5EEAD4;
    --tt-border-subtle: rgba(45, 212, 191, 0.12);
    --tt-border-strong: rgba(45, 212, 191, 0.25);
    --tt-primary: #2DD4BF;
    --tt-primary-hover: #14B8A6;
    --tt-primary-subtle: rgba(45, 212, 191, 0.15);
    --tt-accent-cyan: #38BDF8;
    --tt-accent-warm: #FB923C;
    --tt-success: #34D399;
    --tt-warning: #FB923C;
    --tt-error: #F87171;
  }

  :root[data-theme="light"] {
    --tt-bg-canvas: #F9F9F6;
    --tt-bg-surface: #FFFFFF;
    --tt-bg-elevated: #F0FDF4;
    --tt-bg-sunken: #EDF5F3;
    --tt-text-primary: #134E4A;
    --tt-text-secondary: #2D6A4F;
    --tt-text-muted: #0D9488;
    --tt-border-subtle: #CCFBF1;
    --tt-border-strong: #99F6E4;
    --tt-primary: #0F766E;
    --tt-primary-hover: #115E59;
    --tt-primary-subtle: rgba(15, 118, 110, 0.10);
    --tt-accent-cyan: #0284C7;
    --tt-accent-warm: #EA580C;
    --tt-success: #059669;
    --tt-warning: #EA580C;
    --tt-error: #DC2626;
  }
}
```

---

## 4. Component Hierarchy & File Structure

```
frontend/src/
├── assets/
│   └── logo.svg                 # Vector T-DAG Monogram
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx         # Global frame, navigation, sidebar toggle
│   │   ├── Header.tsx           # Logo, status telemetry dot, theme switcher
│   │   └── Sidebar.tsx          # Nav links, dataset selector, recent chats
│   ├── studio/
│   │   ├── CommandDock.tsx      # Text input form, speech button, run button
│   │   ├── TelemetryRail.tsx    # Live LangGraph step indicator with timing
│   │   ├── ChatMessage.tsx      # Assistant markdown response with SQL expander
│   │   ├── ChartViewer.tsx      # Plotly.js chart renderer with theme sync
│   │   └── DataGrid.tsx         # TanStack virtualized table with tabular-nums
│   ├── datasets/
│   │   ├── DatasetList.tsx      # Parquet catalog table with health badges
│   │   ├── FileUploadModal.tsx  # Drag & drop CSV/Parquet uploader
│   │   └── CleaningModal.tsx    # OOP cleaning pipeline execution report
│   ├── common/
│   │   ├── Button.tsx           # Standardized button with primary/subtle variants
│   │   ├── Badge.tsx            # Semantic status and column type pills
│   │   └── ThemeToggle.tsx      # Segmented Dark/Light switch
├── hooks/
│   ├── useTheme.ts              # Theme state management and data-theme sync
│   ├── useChatStream.ts         # SSE streaming client connecting to /chat/stream
│   └── useDatasets.ts           # SWR/Fetch hook for dataset catalog and health
├── lib/
│   ├── api.ts                   # Typed Axios/Fetch client for FastAPI backend
│   ├── plotlyTheme.ts           # Dynamic Plotly layout generator for Nordic Teal
│   └── utils.ts                 # ClassName merger (clsx + tailwind-merge)
├── store/
│   └── useAppStore.ts           # Zustand store for messages, dataset_id, theme
├── types/
│   ├── api.ts                   # Backend response contracts (ChatResponse, etc.)
│   └── dataset.ts               # Dataset, AuditReport, ColumnStat interfaces
├── App.tsx                      # Root view router
├── main.tsx                     # Entry point mounting React DOM
└── index.css                    # Master stylesheet with Nordic Teal tokens
```

---

## 5. API Client & Streaming Contract

### TypeScript Interfaces (`src/types/api.ts`)

```typescript
export interface ChatRequest {
  dataset_id: string;
  query: string;
  max_retries?: number;
}

export interface TableResult {
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
  duration_ms: number;
}

export interface ChatCompletionPayload {
  summary: string;
  sql: string;
  plotly_spec: Record<string, any> | null;
  table: TableResult;
  self_healed: boolean;
  retries: number;
}

export type StreamEvent =
  | { event: 'status'; data: { step: string; message: string } }
  | { event: 'sql'; data: { sql: string } }
  | { event: 'self_heal'; data: { message: string; repaired_sql: string; retry_count: number } }
  | { event: 'complete'; data: ChatCompletionPayload }
  | { event: 'error'; data: { error: string } };
```

### Real-time SSE Hook (`src/hooks/useChatStream.ts`)

Uses `@microsoft/fetch-event-source` to maintain reliable streaming even across long-running queries:

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

export async function streamChatQuery(
  req: ChatRequest,
  onEvent: (event: StreamEvent) => void,
  onError: (error: Error) => void
) {
  await fetchEventSource('http://localhost:8000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    onmessage(msg) {
      if (msg.event && msg.data) {
        onEvent({ event: msg.event as any, data: JSON.parse(msg.data) });
      }
    },
    onerror(err) {
      onError(err);
      throw err; // Stop retries on terminal failure
    }
  });
}
```

---

## 6. Engineering Best Practices & Invariants

1. **Zero AI Slop:** No purple radial gradients, no generic pulsating glowing orbs, no floating decorative blobs, no emoji clutter.
2. **Tabular Numerals (`tabular-nums`):** All numeric metrics, execution durations (`14.2ms`), row counts, and data table columns must enforce `font-variant-numeric: tabular-nums` to prevent decimal jitter.
3. **Contrast Calibration:** Dark mode must maintain at least 7:1 contrast on all body text (Nordic Teal achieves 16.8:1). Light mode must achieve at least 7:1 (Nordic Birch achieves 14.2:1).
4. **Resilient Error Boundaries:** Failed chart specifications or malformed SQL queries must degrade gracefully to raw table inspection with explicit error notices.
5. **Strict TypeScript:** No implicit `any`. All API responses and component props must be fully typed.

---

## 7. Implementation Roadmap

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Foundation & Packages** | Install Tailwind CSS v4, Lucide React, Zustand, `@tanstack/react-table`, `plotly.js-dist-min`, `react-plotly.js`, `@microsoft/fetch-event-source`. Configure Nordic Teal theme. |
| **Phase 2** | **App Shell & Theme** | Build `AppShell`, `Sidebar`, `Header`, and `ThemeToggle` with the SVG T-DAG Monogram and telemetry indicators. |
| **Phase 3** | **Analytical Studio View** | Implement `CommandDock`, `TelemetryRail`, `ChatMessage`, `ChartViewer` (Plotly integration), and `DataGrid` (TanStack Table). Wire to `/api/chat/stream`. |
| **Phase 4** | **Data Lake & Ingestion** | Build `/datasets` view with Parquet file table, drag-and-drop uploader, and one-click data cleaning trigger. |
| **Phase 5** | **Quality Audit View** | Build `/audit` view with column statistics, null gauges, and health score visualizers. |
| **Phase 6** | **Verification & Packaging** | Run end-to-end audit: test against live FastAPI server, verify dark/light switching, test query streaming, run `npm run build` and `npm run lint`. |
