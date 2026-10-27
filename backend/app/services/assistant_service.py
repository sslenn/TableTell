"""
AI Assistant Service for TableTell.
Acts as a data science tutor, data engineering mentor, and TableTell platform navigator.
Enriched with live context (active tab, selected dataset, health score, active columns).
Powered by Google Gemini Flash via router.dockified.com with graceful offline guidance fallback.
"""

import json
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.analytics.sql_generator import get_gemini_client

ASSISTANT_SYSTEM_PROMPT = """You are the TableTell Copilot — an expert data engineering assistant, statistical educator, and platform guide built into the TableTell Autonomous BI platform.

YOUR MISSION & DOMAINS:
1. TABLETELL PRODUCT ARCHITECTURE & VALUE PROPOSITION:
   - What is TableTell: An Autonomous Agentic Business Intelligence Platform and Deterministic Lakehouse Assistant that turns raw tabular datasets into mathematically verified business intelligence.
   - Core Value: Eliminates mathematical hallucinations and black-box data manipulation by combining a LangGraph state DAG with an in-process DuckDB columnar execution engine.
   - Lakehouse Immutability:
     * Raw uploads are permanently preserved in 'data_lake/raw/'. TableTell NEVER mutates or deletes your source files.
     * Every cleaning transformation generates a new, versioned Apache Parquet file in 'data_lake/processed/' (v1.parquet -> v2.parquet -> v3.parquet).
     * SQLite metadata repository ('data_lake/metadata/tabletell_metadata.db') records full audit lineage, analytical runs, timestamps, durations, and user approvals.
   - Vectorized DuckDB Engine:
     * 100% of arithmetic, sums, averages, counts, percentiles, and group-bys execute directly in DuckDB's C++ vectorized engine in milliseconds.
     * Zero math hallucination: The LLM only writes read-only SQL queries and synthesizes executive takeaways.
   - Read-Only Security Guardrails:
     * All SQL execution is sandboxed and read-only.
     * Forbidden statements are blocked before execution: DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE, CREATE, ATTACH, DETACH, PRAGMA, COPY, etc.
   - Autonomous Self-Healing:
     * Powered by a LangGraph cyclical DAG.
     * If DuckDB reports a BinderException (e.g. slight column misspelling) or syntax error, the error traceback is routed to the self-heal node, which diagnoses the issue, corrects the SQL, and re-executes automatically. The UI displays the "Self-Healed" badge.
   - Real-Time Streaming & Instant Query Cancellation:
     * Analytical progress streams over Server-Sent Events (SSE).
     * Clicking the "Stop" button triggers client-side AbortController with backend disconnect detection, terminating query execution immediately with zero zombie compute.
   - Data Privacy & Governance:
     * TableTell is privacy-first: Raw dataset records are NEVER sent to third-party LLM servers.
     * Only the dataset schema digest (column names and data types) and sample aggregated outputs (top results) are passed to the AI model.
   - Ingestion & Supported Formats:
     * Supports CSV (.csv), Excel (.xlsx, .xls), and Apache Parquet (.parquet).
     * Automatically normalizes headers into clean snake_case and infers optimal data types.

2. 5-DIMENSION DATA HEALTH ENGINE (100-Point Scorecard):
   - Completeness (25% weight): Penalizes missing primary keys and null ratios across columns.
   - Validity (25% weight): Detects negative pricing or quantities, invalid values, and mixed date formats (e.g. converting MM/DD/YYYY to ISO-8601 YYYY-MM-DD).
   - Consistency (20% weight): Checks for snake_case column headers and strips illegal whitespace/special characters.
   - Uniqueness (15% weight): Flags exact duplicate rows and primary key collisions.
   - Anomaly Review (15% weight): Employs Tukey's 1.5x IQR rule for numerical outlier detection and fuzzy typo clustering for rare categorical values.
   - Score Interpretation:
     * 80–100%: Enterprise-ready for dashboards and reporting.
     * 60–79%: Functional, but recommended to review anomalies or run Auto-Clean.
     * Below 60%: Requires data cleaning before reliable reporting.

3. EXPLAINABLE DATA CLEANING WORKFLOW (Auto-Clean):
   - Step 1: Profiling & Audit scan across all 5 dimensions.
   - Step 2: Explainable Proposals generated (e.g., "Drop 2 duplicate rows", "Standardize date format to ISO-8601").
   - Step 3: User reviews proposals in the 'Audit' or 'Datasets' tab and clicks approve.
   - Step 4: Atomic Parquet lakehouse version creation without touching raw files.

4. UI VIEWS & USER GUIDE:
   - 'Studio': Conversational natural language query dock with speech-to-text voice input, Plotly interactive charts (bar, line/trend, scatter, KPI cards), TanStack table preview, and live execution telemetry.
   - 'Datasets': Catalog overview, drag-and-drop file upload, inline dataset renaming (which synchronizes Parquet filenames, DuckDB catalog views, and SQLite metadata), and 1-click Auto-Clean.
   - 'Audit': 5-dimension scorecard, Distribution Profiler with interactive histograms, box plots, and categorical frequencies.
   - 'Telemetry': Live health monitoring, SQLite integrity, DuckDB engine connectivity, query latency, and complete agent execution history.

5. DATA SCIENCE & STATISTICS TUTOR:
   - Teach statistical concepts clearly: IQR outliers, quartiles (Q1, Median/Q2, Q3), skewness, normal vs. multimodal distributions.
   - Variable types: Nominal (no order, e.g. Country), Ordinal (inherent rank, e.g. Customer Tier), Discrete (counts), Continuous Ratio (revenue, prices).
   - Practical trade-offs: Why median imputation is safer than mean for skewed data, and why Parquet is 70-90% smaller and 10-50x faster than CSV.

6. LIVE CONTEXT AWARENESS & DATASET COACHING:
   - When asked "What can I ask?" or "Suggest questions", examine the CURRENT SESSION CONTEXT below:
     * Inspect the active column names and data types.
     * Propose 3 to 4 concrete, high-value business inquiries (e.g., Pareto revenue concentration, monthly trend velocity, cohort retention).
     * Give exact, copy-pasteable prompt phrases for the Studio query dock.
   - When asked about the Health Score, reference their specific score from context and suggest actionable steps.

TONE & FORMATTING GUIDELINES:
- Friendly, authoritative, articulate, and structured.
- Always format column names, SQL keywords, and formulas in `inline code` or markdown blocks.
- Use bullet points and callout tips for high readability.
"""

FALLBACK_KNOWLEDGE_BASE: Dict[str, str] = {
    "what_is_tabletell": (
        "### 🏛️ What is TableTell?\n\n"
        "**TableTell** is an **Autonomous AI Data Analyst and Deterministic Lakehouse Assistant** designed to turn raw datasets into mathematically verified business intelligence.\n\n"
        "Key Differentiators:\n"
        "1. **Zero Math Hallucination**: AI generates read-only SQL, but **100% of arithmetic and aggregations execute in DuckDB's C++ vectorized engine**.\n"
        "2. **Immutable Lakehouse**: Raw files in `data_lake/raw/` are never overwritten. Cleaning operations produce versioned Apache Parquet files (`v1` $\\rightarrow$ `v2`).\n"
        "3. **Autonomous Self-Healing**: If a query encounters a DuckDB syntax or column error, the LangGraph agent intercepts the traceback, repairs the SQL, and re-executes automatically."
    ),
    "iqr": (
        "### 📊 What is 1.5× IQR (Interquartile Range)?\n\n"
        "In statistics, the **Interquartile Range (IQR)** measures the spread of the middle 50% of your data:\n"
        "- **Q1 (25th percentile)**: 25% of values fall below this point.\n"
        "- **Q3 (75th percentile)**: 75% of values fall below this point.\n"
        "- **IQR = Q3 - Q1**\n\n"
        "**John Tukey's Fences Rule** flags an observation as an outlier if:\n"
        "- Value < `Q1 - 1.5 × IQR` (Lower Outlier)\n"
        "- Value > `Q3 + 1.5 × IQR` (Upper Outlier)\n\n"
        "> 💡 **In TableTell**: Outliers are flagged under the **Audit** tab for review. TableTell never deletes them blindly, because high-value orders or bulk transactions are often legitimate business events!"
    ),
    "clean": (
        "### 🧹 How Data Cleaning & Auto-Clean Works in TableTell\n\n"
        "TableTell follows a **deterministic 4-stage pipeline**:\n"
        "1. **Audit & Profiling**: DuckDB scans the dataset across 5 dimensions (Completeness, Validity, Consistency, Uniqueness, Anomaly).\n"
        "2. **Explainable Proposals**: Generates actionable proposals (e.g., *'Drop 2 duplicate rows'*, *'Convert date format to ISO-8601'*, *'Sanitize negative prices'*).\n"
        "3. **User Approval**: You review and approve proposals in the **Audit** or **Datasets** tab.\n"
        "4. **Safe Versioning**: Transformations run without touching your raw file, generating a clean `v2.parquet` file with before-and-after audit logs."
    ),
    "health_score": (
        "### 🎯 The TableTell 100-Point Health Score\n\n"
        "TableTell evaluates dataset hygiene across 5 standard enterprise dimensions:\n"
        "- **Completeness (25%)**: Penalizes missing primary keys and null fields.\n"
        "- **Validity (25%)**: Flags negative numbers in quantity/price and irregular date formats.\n"
        "- **Consistency (20%)**: Checks for clean snake_case column names without illegal SQL symbols.\n"
        "- **Uniqueness (15%)**: Measures exact row duplication and primary key collisions.\n"
        "- **Anomaly Review (15%)**: Evaluates 1.5x IQR outliers and categorical typos.\n\n"
        "> 💡 Scores above **80/100** are considered enterprise-ready for analytics and dashboards."
    ),
    "nominal": (
        "### 🏷️ Nominal vs. Ordinal Categorical Data\n\n"
        "Both represent text categories, but with one critical distinction:\n\n"
        "1. **Nominal (No Order)**:\n"
        "   - Categories cannot be ranked or sorted naturally.\n"
        "   - *Examples*: `Country` ('USA', 'France'), `Payment Method` ('Cash', 'Card'), `Color` ('Red', 'Blue').\n\n"
        "2. **Ordinal (Inherent Order / Hierarchy)**:\n"
        "   - Categories have a meaningful sequence, ranking, or scale.\n"
        "   - *Examples*: `Customer Tier` ('Bronze' < 'Silver' < 'Gold'), `Survey Rating` ('Poor' < 'Good' < 'Excellent').\n\n"
        "> 💡 **In TableTell**: You can inspect distributions for both under the **Distribution Profiler** in the **Audit** tab!"
    ),
    "parquet": (
        "### ⚡ Why TableTell Uses Parquet Instead of CSV\n\n"
        "When you upload a CSV or Excel file, TableTell immediately converts it to **Apache Parquet**:\n"
        "- **70%–90% Smaller Disk Footprint**: Uses Snappy/ZSTD compression and dictionary encoding.\n"
        "- **Columnar Storage (Projection Pushdown)**: When you query 2 columns, DuckDB reads *only* those 2 columns from disk, leaving the rest untouched.\n"
        "- **Strict Data Typing**: Guarantees numbers remain numbers and dates don't get corrupted into strings.\n"
        "- **10x–50x Faster Analytics**: Vectorized engines like DuckDB process columnar Parquet chunks in SIMD CPU registers."
    ),
    "duckdb": (
        "### 🦆 Why DuckDB Instead of SQLite for Analytics?\n\n"
        "While SQLite is world-class for transactional (OLTP) storage, **DuckDB is purpose-built for analytical (OLAP) workloads**:\n\n"
        "1. **Columnar vs Row-Oriented**: DuckDB scans only the queried columns; SQLite scans entire rows.\n"
        "2. **Vectorized Execution**: DuckDB processes data in vectors of 2,048 values using CPU SIMD instructions.\n"
        "3. **Zero-Copy Parquet Reads**: DuckDB reads Parquet files directly from disk without importing them into an internal database file.\n"
        "4. **Rich Analytical SQL**: Native support for window functions, statistical aggregates (`MEDIAN`, `APPROX_COUNT_DISTINCT`), and date math.\n\n"
        "> 💡 **In TableTell**: DuckDB powers the analytical engine in `backend/app/analytics/`, while SQLite manages metadata and audit lineage."
    ),
    "self_heal": (
        "### 🔄 How Autonomous Self-Healing Works\n\n"
        "In traditional text-to-SQL, an invalid column name or syntax error immediately breaks the user experience.\n\n"
        "**TableTell solves this using a LangGraph cyclical DAG**:\n"
        "1. **Generate**: The agent generates DuckDB SQL based on the schema.\n"
        "2. **Execute**: The query runs against sandboxed DuckDB views.\n"
        "3. **Detect**: If DuckDB throws an error (e.g., `BinderException: Column 'rev' not found`), the execution node catches the error.\n"
        "4. **Self-Heal Loop**: The error traceback, failed SQL, and schema are passed to the `self_heal` node to diagnose the mistake and repair the query.\n"
        "5. **Re-Execute**: The repaired query executes automatically, and the UI displays the **'Self-Healed'** badge!"
    ),
    "file_formats": (
        "### 📁 Supported File Formats in TableTell\n\n"
        "TableTell supports the following tabular formats:\n"
        "- **CSV (`.csv`)**: Delimiter auto-detected (comma, semicolon, tab), encoding normalized to UTF-8.\n"
        "- **Excel (`.xlsx`, `.xls`)**: First sheet parsed, headers normalized, types inferred.\n"
        "- **Apache Parquet (`.parquet`)**: Loaded with zero-copy projection.\n\n"
        "All uploaded files are preserved in `data_lake/raw/` and converted into optimized Parquet files in `data_lake/processed/`."
    ),
    "immutability": (
        "### 🛡️ Lakehouse Immutability & Versioning\n\n"
        "In TableTell, **data lineage is immutable**:\n"
        "- Your uploaded file is stored in `data_lake/raw/` as the permanent source of truth.\n"
        "- Cleaning operations NEVER mutate or overwrite the source file.\n"
        "- Every transformation creates a new Parquet version (`v1.parquet` $\\rightarrow$ `v2.parquet` $\\rightarrow$ `v3.parquet`).\n"
        "- Full before-and-after audit logs are recorded in SQLite, allowing you to trace every modified row and revert if needed."
    ),
    "privacy": (
        "### 🔒 Data Privacy & Security Governance\n\n"
        "TableTell is designed with strict data privacy:\n"
        "1. **Raw Data Never Leaves Your Environment**: Your full dataset rows are **never** uploaded to external LLM servers.\n"
        "2. **Schema-Only AI Context**: The LLM only receives column names, data types, and small sample aggregations needed to synthesize SQL and executive takeaways.\n"
        "3. **In-Process Compute**: 100% of mathematical computation, filtering, and aggregation runs locally in DuckDB's C++ engine.\n"
        "4. **Read-Only Sandbox**: Forbidden DDL/DML statements (`DROP`, `DELETE`, `UPDATE`, `ALTER`, `ATTACH`) are blocked before execution."
    ),
    "duplicate": (
        "### 👥 Is It Safe to Drop Duplicate Rows?\n\n"
        "In TableTell, the **Uniqueness (15%)** check flags rows where every column value is identical.\n\n"
        "**When it is safe to drop**:\n"
        "- When you have transactional records with unique IDs (e.g. `order_id` or `user_id`) duplicated due to an ingestion glitch.\n"
        "- When identical rows represent duplicate logging.\n\n"
        "**When to keep**:\n"
        "- When rows represent identical item purchases without a unique line-item ID.\n\n"
        "> 💡 **Protection**: TableTell's Auto-Clean gives you an **explainable proposal** showing the exact number of duplicates found before performing the deduplication into a new `v2.parquet` file."
    ),
    "telemetry": (
        "### ⚡ Telemetry & Run History\n\n"
        "The **Telemetry** tab provides end-to-end operational visibility:\n"
        "- **System Diagnostics**: Monitors DuckDB engine status, SQLite integrity, and data lake disk usage.\n"
        "- **Query Latency**: Execution durations broken down by SQL generation, DuckDB execution, and visualization synthesis.\n"
        "- **Execution Run History**: Complete audit trail of past queries, self-healing retries, and generated SQL queries stored in `data_lake/metadata/tabletell_metadata.db`."
    ),
    "cancel": (
        "### ⏹️ Real-Time Streaming & Instant Cancellation\n\n"
        "TableTell features zero-zombie compute streaming:\n"
        "- Query progress streams over **Server-Sent Events (SSE)** in real-time (`planning` $\\rightarrow$ `executing` $\\rightarrow$ `visualizing`).\n"
        "- Clicking the **'Stop'** button toggles a client-side `AbortController` and signals the backend disconnect handler to abort execution immediately.\n"
        "- Your previous prompt is automatically preserved in the query dock so you can refine and re-run."
    )
}


class AssistantService:
    def get_or_create_conversation(self, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """Resolves active conversation or returns default thread."""
        if conversation_id:
            conv = metadata_repo.get_or_create_default_conversation()
            return conv
        return metadata_repo.get_or_create_default_conversation()

    def get_history(self, conversation_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetches chronological messages for the active assistant thread."""
        conv = self.get_or_create_conversation(conversation_id)
        return metadata_repo.list_assistant_messages(conv["id"])

    def clear_history(self, conversation_id: Optional[str] = None) -> None:
        """Clears all messages in the active thread."""
        conv = self.get_or_create_conversation(conversation_id)
        metadata_repo.clear_assistant_history(conv["id"])

    def _format_context_prompt(self, context: Optional[Dict[str, Any]]) -> str:
        """Formats session context into a structured system block for the model."""
        if not context:
            return ""

        lines = ["CURRENT SESSION CONTEXT:"]
        if context.get("current_tab"):
            lines.append(f"- Active Tab/Screen: '{context['current_tab']}'")
        if context.get("dataset_id"):
            ds_name = context.get("dataset_name") or context.get("dataset_id")
            rows = f" ({context['total_rows']:,} rows)" if context.get("total_rows") is not None else ""
            lines.append(f"- Active Dataset: `{ds_name}`{rows}")
        if context.get("health_score") is not None:
            score = round(float(context["health_score"]), 1)
            lines.append(f"- Dataset Quality Health Score: {score}/100")
        if context.get("columns"):
            cols = ", ".join(f"`{c}`" for c in context["columns"][:25])
            lines.append(f"- Available Columns: {cols}")
        if context.get("audit_summary"):
            summary_str = json.dumps(context["audit_summary"], default=str)
            lines.append(f"- Audit Profile Summary: {summary_str}")

        return "\n".join(lines)

    def ask_assistant(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Processes a user question:
        1. Saves user query to SQLite
        2. Injects current UI/dataset context into prompt
        3. Calls AI model (Gemini 3.8 Flash via router or fallback)
        4. Saves assistant answer to SQLite
        5. Returns answer and conversation metadata
        """
        conv = self.get_or_create_conversation(conversation_id)
        conv_id = conv["id"]

        # 1. Save user query
        metadata_repo.save_assistant_message(conv_id, role="user", content=query)

        # 2. Build history context for LLM
        recent_msgs = metadata_repo.list_assistant_messages(conv_id, limit=8)
        history_context = []
        for m in recent_msgs[:-1]:
            history_context.append(f"{m['role'].capitalize()}: {m['content']}")

        client = get_gemini_client()
        reply_content = ""

        context_str = self._format_context_prompt(context)
        history_str = "\n".join(history_context)

        prompt_parts = [ASSISTANT_SYSTEM_PROMPT]
        if context_str:
            prompt_parts.append(context_str)
        if history_str:
            prompt_parts.append(f"Recent Conversation History:\n{history_str}")
        prompt_parts.append(f"User Question: {query}\n\nCopilot Response:")
        full_prompt = "\n\n".join(prompt_parts)

        if client:
            try:
                target_model = settings.DEFAULT_MODEL or "agy/gemini-3.8-flash-high"
                resp = client.models.generate_content(
                    model=target_model,
                    contents=full_prompt
                )
                reply_content = resp.text.strip()
            except Exception as e:
                reply_content = self._generate_fallback_response(query, context=context, error_msg=str(e))
        else:
            reply_content = self._generate_fallback_response(query, context=context)

        # 3. Save assistant response
        saved_msg = metadata_repo.save_assistant_message(conv_id, role="assistant", content=reply_content)

        return {
            "status": "success",
            "reply": reply_content,
            "message_id": saved_msg["id"],
            "conversation_id": conv_id,
            "created_at": saved_msg["created_at"]
        }

    async def stream_assistant(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Server-Sent Events streaming generator for real-time word-by-word token delivery.
        """
        conv = self.get_or_create_conversation(conversation_id)
        conv_id = conv["id"]
        metadata_repo.save_assistant_message(conv_id, role="user", content=query)

        client = get_gemini_client()
        full_text = ""

        yield {
            "event": "status",
            "data": json.dumps({"status": "thinking", "message": "Analyzing question & consulting TableTell knowledge base..."})
        }
        await asyncio.sleep(0.05)

        context_str = self._format_context_prompt(context)

        if client:
            try:
                recent_msgs = metadata_repo.list_assistant_messages(conv_id, limit=6)
                history_str = "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in recent_msgs[:-1])

                prompt_parts = [ASSISTANT_SYSTEM_PROMPT]
                if context_str:
                    prompt_parts.append(context_str)
                if history_str:
                    prompt_parts.append(f"History:\n{history_str}")
                prompt_parts.append(f"User Question: {query}\n\nCopilot Response:")
                full_prompt = "\n\n".join(prompt_parts)

                target_model = settings.DEFAULT_MODEL or "agy/gemini-3.8-flash-high"
                response_stream = client.models.generate_content_stream(
                    model=target_model,
                    contents=full_prompt
                )
                for chunk in response_stream:
                    token = chunk.text
                    if token:
                        full_text += token
                        yield {
                            "event": "token",
                            "data": json.dumps({"token": token})
                        }
                        await asyncio.sleep(0.01)
            except Exception as e:
                full_text = self._generate_fallback_response(query, context=context, error_msg=str(e))
                yield {
                    "event": "token",
                    "data": json.dumps({"token": full_text})
                }
        else:
            full_text = self._generate_fallback_response(query, context=context)
            words = full_text.split(" ")
            for i, word in enumerate(words):
                chunk_str = word + (" " if i < len(words) - 1 else "")
                yield {
                    "event": "token",
                    "data": json.dumps({"token": chunk_str})
                }
                await asyncio.sleep(0.02)

        saved_msg = metadata_repo.save_assistant_message(conv_id, role="assistant", content=full_text)
        yield {
            "event": "complete",
            "data": json.dumps({
                "reply": full_text,
                "conversation_id": conv_id,
                "message_id": saved_msg["id"]
            })
        }

    def _generate_fallback_response(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        error_msg: Optional[str] = None
    ) -> str:
        """Provides instant, high-quality answers from built-in knowledge base if offline or API key missing."""
        q = query.lower()

        # Contextual dataset suggestions
        if any(term in q for term in ["what can i ask", "suggest", "questions for this", "analyze this"]) and context and context.get("columns"):
            cols = context["columns"]
            ds_name = context.get("dataset_name") or context.get("dataset_id") or "this dataset"
            return (
                f"### 💡 Recommended Questions for `{ds_name}`\n\n"
                f"Based on your table structure with columns {', '.join(f'`{c}`' for c in cols[:6])}:\n\n"
                f"1. **Summary Overview**: *'Show total rows and summary statistics across all numeric fields.'*\n"
                f"2. **Top Category Breakdown**: *'What are the top 5 records grouped by the primary category?'*\n"
                f"3. **Trend / Time Analysis**: *'Show monthly or weekly totals over time as a line chart.'*\n"
                f"4. **Outlier Inspection**: *'Filter and display records with values in the top 5 percentile.'*\n\n"
                f"> 🚀 Copy and paste any of these into the **Studio** query bar!"
            )

        # Topic matching
        if any(term in q for term in ["what is tabletell", "product", "platform", "about tabletell", "why tabletell"]):
            return FALLBACK_KNOWLEDGE_BASE["what_is_tabletell"]
        elif any(term in q for term in ["self-heal", "self healed", "badge", "error recovery"]):
            return FALLBACK_KNOWLEDGE_BASE["self_heal"]
        elif any(term in q for term in ["duckdb", "sqlite"]):
            return FALLBACK_KNOWLEDGE_BASE["duckdb"]
        elif any(term in q for term in ["file format", "formats supported", "upload format", "csv to parquet"]):
            return FALLBACK_KNOWLEDGE_BASE["file_formats"]
        elif any(term in q for term in ["immutability", "immutable", "lakehouse", "overwritten"]):
            return FALLBACK_KNOWLEDGE_BASE["immutability"]
        elif any(term in q for term in ["privacy", "private", "security", "sent to llm", "safe"]):
            return FALLBACK_KNOWLEDGE_BASE["privacy"]
        elif any(term in q for term in ["duplicate", "drop duplicate"]):
            return FALLBACK_KNOWLEDGE_BASE["duplicate"]
        elif any(term in q for term in ["telemetry", "dag", "pipeline", "execution runs", "stored"]):
            return FALLBACK_KNOWLEDGE_BASE["telemetry"]
        elif any(term in q for term in ["cancel", "stop button", "abort"]):
            return FALLBACK_KNOWLEDGE_BASE["cancel"]
        elif any(term in q for term in ["iqr", "outlier", "anomaly"]):
            return FALLBACK_KNOWLEDGE_BASE["iqr"]
        elif any(term in q for term in ["clean", "fix", "repair", "auto-clean", "version"]):
            return FALLBACK_KNOWLEDGE_BASE["clean"]
        elif any(term in q for term in ["score", "health", "dimension", "audit"]):
            score_info = f" Your current dataset score is **{round(context['health_score'], 1)}/100**." if context and context.get("health_score") is not None else ""
            return FALLBACK_KNOWLEDGE_BASE["health_score"] + score_info
        elif any(term in q for term in ["nominal", "ordinal", "categorical", "variable"]):
            return FALLBACK_KNOWLEDGE_BASE["nominal"]
        elif any(term in q for term in ["parquet", "storage", "csv"]):
            return FALLBACK_KNOWLEDGE_BASE["parquet"]

        # Default fallback
        return (
            f"### ⚡ TableTell Copilot\n\n"
            f"I can help you explore and understand your data and the TableTell platform! Here are some common topics I can explain:\n\n"
            f"- **'What is TableTell?'**: Learn about the deterministic lakehouse architecture.\n"
            f"- **'Explain 1.5x IQR'**: How TableTell detects statistical outliers.\n"
            f"- **'How does Auto-Clean work?'**: How proposals and Parquet versioning protect raw data.\n"
            f"- **'What is the Health Score?'**: How the 5 quality dimensions are calculated.\n"
            f"- **'Explain Self-Healed badge'**: How the LangGraph error recovery loop works.\n"
            f"- **'Is my data private?'**: How TableTell guarantees zero raw data transmission to LLMs.\n"
            f"- **'Why DuckDB instead of SQLite?'**: Why vectorized in-process execution is faster."
        )


assistant_service = AssistantService()
