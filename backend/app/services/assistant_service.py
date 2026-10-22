"""
AI Assistant Service for TableTell.
Acts as a data science tutor, data engineering mentor, and TableTell platform navigator.
Powered by Google Gemini Flash with graceful offline guidance fallback.
"""

import json
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.analytics.sql_generator import get_gemini_client

ASSISTANT_SYSTEM_PROMPT = """You are the TableTell Copilot — an expert data engineering assistant, statistical educator, and platform guide built into the TableTell Autonomous BI platform.

YOUR MISSION & DOMAINS:
1. TABLETELL PLATFORM KNOWLEDGE:
   - Architecture: Inverted Lakehouse with immutable raw files in 'data_lake/raw/' and versioned columnar Parquet files in 'data_lake/processed/'.
   - Vectorized Analytics: All SQL calculations run on DuckDB in C++ without math hallucinations. Queries are read-only and run against sandboxed views.
   - 5-Dimension Health Scoring (100/100):
     * Completeness (25%): Missing values and critical entity key detection.
     * Validity (25%): Negative quantity/price sanitization and mixed date formatting (MM.DD.YY -> ISO-8601).
     * Consistency (20%): Snake_case headers and character stripping.
     * Uniqueness (15%): Exact row deduplication.
     * Anomaly Review (15%): 1.5x IQR numerical outliers and categorical fuzzy typo/rare value detection.
   - Cleaning Workflow: Generates explainable approval plans with before-and-after regression checks, incrementing dataset versions (v1 -> v2 -> v3).
   - UI Views:
     * 'Studio': Conversational AI query dock, Plotly charts, columnar data grid, and live telemetry trace.
     * 'Datasets': Catalog overview, file drag-and-drop upload, and 1-click clean trigger.
     * 'Audit': 5-dimension scorecard, distribution profiler (histograms, box plots, categorical frequencies).
     * 'Telemetry': Full agent execution history and query latency logs.

2. DATA SCIENCE & STATISTICS TUTOR:
   - Teach statistical concepts clearly: IQR outliers, quartiles (Q1, Q2/Median, Q3), skewness (left/right/tail), kurtosis, normal vs. multimodal distributions.
   - Explain variable types: Nominal (labels/IDs), Ordinal (ordered ranks/tiers), Discrete (counts), Continuous Interval (dates/temperature) vs. Ratio (prices/revenue).
   - Clarify data engineering trade-offs: why imputation with median is safer than mean for skewed data, why trailing whitespace breaks SQL joins, and why Parquet is faster than CSV.

TONE & FORMATTING GUIDELINES:
- Friendly, articulate, concise, and structured.
- Always format code, column names, formulas, and SQL keywords in `inline code` or markdown blocks.
- Use bullet points for readability.
- When guiding user actions, reference the exact TableTell UI tab names ('Studio', 'Datasets', 'Audit', 'Telemetry').
"""

FALLBACK_KNOWLEDGE_BASE: Dict[str, str] = {
    "iqr": (
        "### 📊 What is 1.5× IQR (Interquartile Range)?\n\n"
        "In statistics, the **Interquartile Range (IQR)** represents the spread of the middle 50% of your data:\n"
        "- **Q1 (25th percentile)**: 25% of values fall below this point.\n"
        "- **Q3 (75th percentile)**: 75% of values fall below this point.\n"
        "- **IQR = Q3 - Q1**\n\n"
        "**John Tukey's Rule** flags any value as an outlier if:\n"
        "- Value < `Q1 - 1.5 × IQR` (Lower Outlier)\n"
        "- Value > `Q3 + 1.5 × IQR` (Upper Outlier)\n\n"
        "> 💡 **In TableTell**: Outliers are flagged in the **Audit** tab for review. TableTell never deletes them blindly, because high-value sales are often legitimate business transactions!"
    ),
    "clean": (
        "### 🧹 How Data Cleaning Works in TableTell\n\n"
        "TableTell follows a **deterministic 4-stage pipeline**:\n"
        "1. **Audit & Profiling**: DuckDB scans the dataset across 5 dimensions (Completeness, Validity, Consistency, Uniqueness, Anomaly).\n"
        "2. **Explainable Proposals**: Generates actionable proposals (e.g., *'Drop 2 duplicate rows'*, *'Merge typos in country'*).\n"
        "3. **User Approval**: You review and approve proposals in the **Audit** or **Datasets** tab.\n"
        "4. **Safe Versioning**: Transformations run without overwriting your raw file, generating a clean `v2.parquet` file with before-and-after audit logs."
    ),
    "health_score": (
        "### 🎯 The TableTell 100-Point Health Score\n\n"
        "TableTell weights dataset quality across 5 standard enterprise dimensions:\n"
        "- **Completeness (25%)**: Penalizes missing primary keys and null fields.\n"
        "- **Validity (25%)**: Flags negative numbers in quantity/price and irregular date patterns.\n"
        "- **Consistency (20%)**: Checks for clean snake_case column names without illegal SQL symbols.\n"
        "- **Uniqueness (15%)**: Measures exact row duplication and primary key collisions.\n"
        "- **Anomaly Review (15%)**: Evaluates 1.5x IQR outliers and categorical typos.\n\n"
        "> 💡 Scores above **80/100** are considered ready for business analytics and dashboards."
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
        "> 💡 **In TableTell**: You can inspect both under the **Distribution Profiler** in the **Audit** tab!"
    ),
    "parquet": (
        "### ⚡ Why TableTell Uses Parquet Instead of CSV\n\n"
        "When you upload a CSV, TableTell immediately converts it to **Apache Parquet**:\n"
        "- **70%–90% Smaller Disk Footprint**: Uses Snappy/ZSTD compression and dictionary encoding.\n"
        "- **Columnar Storage (Projection Pushdown)**: When you query 2 columns, DuckDB reads *only* those 2 columns from disk, leaving the other 30 columns untouched.\n"
        "- **Strong Data Typing**: Prevents numbers from turning into strings or dates getting corrupted."
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

    def ask_assistant(self, query: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Processes a user question:
        1. Saves user query to SQLite
        2. Calls Gemini Flash with Grounded System Prompt
        3. Saves assistant answer to SQLite
        4. Returns answer and conversation metadata
        """
        conv = self.get_or_create_conversation(conversation_id)
        conv_id = conv["id"]

        # 1. Save user query
        metadata_repo.save_assistant_message(conv_id, role="user", content=query)

        # 2. Build history context for LLM
        recent_msgs = metadata_repo.list_assistant_messages(conv_id, limit=8)
        history_context = []
        for m in recent_msgs[:-1]:  # exclude just saved message to avoid duplication
            history_context.append(f"{m['role'].capitalize()}: {m['content']}")

        client = get_gemini_client()
        reply_content = ""

        if client:
            try:
                full_prompt = f"{ASSISTANT_SYSTEM_PROMPT}\n\nRecent Conversation History:\n" + "\n".join(history_context) + f"\n\nUser: {query}\n\nCopilot:"
                resp = client.models.generate_content(
                    model=settings.DEFAULT_MODEL or "gemini-2.5-flash",
                    contents=full_prompt
                )
                reply_content = resp.text.strip()
            except Exception as e:
                reply_content = self._generate_fallback_response(query, error_msg=str(e))
        else:
            reply_content = self._generate_fallback_response(query)

        # 3. Save assistant response
        saved_msg = metadata_repo.save_assistant_message(conv_id, role="assistant", content=reply_content)

        return {
            "status": "success",
            "reply": reply_content,
            "message_id": saved_msg["id"],
            "conversation_id": conv_id,
            "created_at": saved_msg["created_at"]
        }

    async def stream_assistant(self, query: str, conversation_id: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
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

        if client:
            try:
                recent_msgs = metadata_repo.list_assistant_messages(conv_id, limit=6)
                history_str = "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in recent_msgs[:-1])
                full_prompt = f"{ASSISTANT_SYSTEM_PROMPT}\n\nHistory:\n{history_str}\n\nUser: {query}\n\nCopilot:"

                # Stream response tokens
                response_stream = client.models.generate_content_stream(
                    model=settings.DEFAULT_MODEL or "gemini-2.5-flash",
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
                full_text = self._generate_fallback_response(query, error_msg=str(e))
                yield {
                    "event": "token",
                    "data": json.dumps({"token": full_text})
                }
        else:
            full_text = self._generate_fallback_response(query)
            # Simulate streaming tokens for smooth UX when in offline mode
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

    def _generate_fallback_response(self, query: str, error_msg: Optional[str] = None) -> str:
        """Provides instant, high-quality answers from built-in knowledge base if offline or API key missing."""
        q_lower = query.lower()

        for key, answer in FALLBACK_KNOWLEDGE_BASE.items():
            if key in q_lower:
                return answer

        if any(term in q_lower for term in ["iqr", "outlier", "anomaly"]):
            return FALLBACK_KNOWLEDGE_BASE["iqr"]
        elif any(term in q_lower for term in ["clean", "fix", "repair", "pipeline", "version"]):
            return FALLBACK_KNOWLEDGE_BASE["clean"]
        elif any(term in q_lower for term in ["score", "health", "dimension", "audit"]):
            return FALLBACK_KNOWLEDGE_BASE["health_score"]
        elif any(term in q_lower for term in ["nominal", "ordinal", "categorical", "variable"]):
            return FALLBACK_KNOWLEDGE_BASE["nominal"]
        elif any(term in q_lower for term in ["parquet", "duckdb", "storage", "csv"]):
            return FALLBACK_KNOWLEDGE_BASE["parquet"]

        api_tip = f"\n\n*(Note: To enable full generative AI chat, ensure your `GEMINI_API_KEY` is set in `.env`)*" if not settings.GEMINI_API_KEY else ""
        return (
            f"### ⚡ TableTell Copilot\n\n"
            f"I can help you explore and understand your data in TableTell! Here are some common topics I can explain:\n\n"
            f"- **'Explain 1.5x IQR'**: How TableTell detects statistical outliers.\n"
            f"- **'How does data cleaning work?'**: How proposals and versioning protect raw data.\n"
            f"- **'What is the Health Score?'**: How the 5 quality dimensions are calculated.\n"
            f"- **'Nominal vs. Ordinal'**: Understanding statistical variable types.\n"
            f"- **'Why Parquet?'**: How columnar storage speeds up DuckDB queries."
            f"{api_tip}"
        )


assistant_service = AssistantService()
