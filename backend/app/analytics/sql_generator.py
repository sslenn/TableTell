"""
Prompt-driven and schema-aware SQL generator for DuckDB.
Supports Gemini AI with schema-aware offline fallback.
"""

import os
import re
from typing import Dict, Any, List, Optional
from app.core.config import settings

# Optional Google GenAI SDK
HAS_GENAI = False
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


SYSTEM_PROMPT = """You are TableTell, an expert AI Data Analyst and Business Intelligence Engineer.
Your task is to write high-efficiency, clean SQL for DuckDB to answer user analytical questions.

RULES FOR DUCKDB SQL:
1. TARGET TABLE: Always query from the table named '{dataset_id}'.
2. COLUMN NAMES: Strictly use exact column names from the provided schema. Wrap column names in double quotes if needed.
3. AGGREGATIONS: Use standard SQL aggregations (SUM, AVG, COUNT, MIN, MAX, GROUP BY, ORDER BY, LIMIT).
4. LIMIT: Do NOT artificially restrict GROUP BY categorical queries with small limits unless the user explicitly requested a top N (e.g. 'top 5'). When aggregating by category, allow returning all groups. If the user asks for 'all rows', 'all records', or raw data, allow up to LIMIT 1000.
5. NO MARKDOWN: Output ONLY the executable SQL query inside a ```sql ``` block. No conversational fluff outside.
"""


def get_gemini_client():
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if api_key and HAS_GENAI:
        try:
            return genai.Client(api_key=api_key)
        except Exception:
            return None
    return None


def extract_sql(raw_text: str) -> str:
    """Extracts raw SQL from LLM response fences."""
    match = re.search(r"```(?:sql)?\s*(.*?)\s*```", raw_text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return raw_text.strip()


def auto_repair_column_binder(failed_sql: str, error_msg: str, candidate_cols: List[str]) -> Optional[str]:
    """Extracts invalid column from DuckDB BinderException and replaces with nearest valid candidate."""
    match = re.search(r'Referenced column "([^"]+)" not found', error_msg)
    if not match or not candidate_cols:
        return None
    invalid_col = match.group(1)

    # Pick candidate
    replacement = candidate_cols[0]
    for c in candidate_cols:
        if not c.lower().endswith("id") and not c.lower().endswith("_id"):
            replacement = c
            break

    repaired_sql = re.sub(rf'\b{re.escape(invalid_col)}\b', replacement, failed_sql)
    return repaired_sql if repaired_sql != failed_sql else None


def simulate_sql_fallback(
    query: str,
    dataset_id: str,
    col_names: List[str],
    dtypes: Dict[str, str]
) -> str:
    """
    Schema-aware SQL generator for offline mode (when GEMINI_API_KEY is not configured).
    Dynamically inspects the actual dataset schema and matches query keywords against
    real columns so it never queries non-existent columns.
    """
    if not col_names:
        return f"SELECT * FROM {dataset_id} LIMIT 10"

    q = query.lower()

    numeric_cols = []
    date_cols = []
    categorical_cols = []

    for col in col_names:
        t = dtypes.get(col, "").upper()
        c_lower = col.lower()
        if any(nt in t for nt in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL"]):
            numeric_cols.append(col)
        elif any(dt in t for dt in ["DATE", "TIME", "TIMESTAMP"]) or any(d in c_lower for d in ["date", "time", "day", "month", "year"]):
            date_cols.append(col)
        else:
            categorical_cols.append(col)

    # Score categorical columns
    best_cat = None
    best_cat_score = -1
    for col in categorical_cols:
        c_clean = col.lower().replace("_", " ")
        words = c_clean.split()
        score = 0
        if c_clean in q:
            score += 10
        for w in words:
            if len(w) > 2 and w in q:
                score += 4
        if col.lower().endswith("id") or col.lower().endswith("_id"):
            score -= 3
        if score > best_cat_score:
            best_cat_score = score
            best_cat = col

    # Score numeric columns
    best_num = None
    best_num_score = -1
    for col in numeric_cols:
        c_clean = col.lower().replace("_", " ")
        words = c_clean.split()
        score = 0
        if c_clean in q:
            score += 10
        for w in words:
            if len(w) > 2 and w in q:
                score += 4
        for kw in ["revenue", "price", "value", "spend", "amount", "cost", "total", "sales", "transaction", "order", "val"]:
            if kw in q and kw in c_clean:
                score += 5
        if score > best_num_score:
            best_num_score = score
            best_num = col

    if not best_cat:
        non_id = [c for c in categorical_cols if not c.lower().endswith("id") and not c.lower().endswith("_id")]
        best_cat = non_id[0] if non_id else (categorical_cols[0] if categorical_cols else col_names[0])

    if not best_num and numeric_cols:
        best_num = numeric_cols[0]

    # Date / Trend query
    if any(tw in q for tw in ["trend", "time", "date", "daily", "monthly", "growth", "over time"]) and date_cols:
        date_col = date_cols[0]
        if best_num:
            return f'SELECT "{date_col}", ROUND(SUM("{best_num}"), 2) AS total_{best_num}, COUNT(*) AS count FROM {dataset_id} GROUP BY "{date_col}" ORDER BY "{date_col}" ASC LIMIT 100'
        return f'SELECT "{date_col}", COUNT(*) AS count FROM {dataset_id} GROUP BY "{date_col}" ORDER BY "{date_col}" ASC LIMIT 100'

    # Standard aggregation
    if best_cat and best_num:
        return f'SELECT "{best_cat}", COUNT(*) AS total_records, ROUND(AVG("{best_num}"), 2) AS avg_{best_num}, ROUND(SUM("{best_num}"), 2) AS total_{best_num} FROM {dataset_id} GROUP BY "{best_cat}" ORDER BY total_records DESC'
    elif best_cat:
        return f'SELECT "{best_cat}", COUNT(*) AS total_records FROM {dataset_id} GROUP BY "{best_cat}" ORDER BY total_records DESC'
    else:
        return f"SELECT * FROM {dataset_id} LIMIT 50"


def generate_sql(
    user_query: str,
    dataset_id: str,
    schema_digest: str,
    col_names: List[str],
    dtypes: Dict[str, str],
) -> str:
    """Orchestrates SQL generation using Gemini or schema-aware fallback."""
    client = get_gemini_client()
    if client:
        try:
            prompt = f"""Dataset Schema:
{schema_digest}

User Question:
"{user_query}"

Write a valid DuckDB SQL query to answer this analytical question. Table name is '{dataset_id}'."""

            resp = client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT.format(dataset_id=dataset_id),
                    temperature=0.1
                )
            )
            return extract_sql(resp.text)
        except Exception:
            return simulate_sql_fallback(user_query, dataset_id, col_names, dtypes)
    else:
        return simulate_sql_fallback(user_query, dataset_id, col_names, dtypes)
