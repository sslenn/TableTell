"""
LangGraph Nodes for TableTell V2.
Orchestrates:
1. generate_sql_node (calls sql_generator)
2. execute_sql_node (calls query_executor with registered views)
3. self_heal_node (error diagnosis & automatic repair)
4. visualize_and_summarize_node (synthesizes Plotly specs & executive takeaway)
"""

import json
import uuid
from typing import Dict, Any, Optional
from app.agent.state import AgentState
from app.agent.prompts import SYSTEM_PROMPT, REPAIR_PROMPT, SUMMARY_PROMPT
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.services.quality_service import quality_service
from app.analytics.sql_generator import (
    get_gemini_client,
    extract_sql,
    auto_repair_column_binder,
    simulate_sql_fallback
)
from app.analytics.executor import query_executor
from app.analytics.visualization import build_plotly_spec

try:
    from google import genai
    from google.genai import types
except ImportError:
    pass


def generate_sql_node(state: AgentState) -> Dict[str, Any]:
    """Node 1: Generates DuckDB SQL from User Query and Schema Digest."""
    client = get_gemini_client()
    dataset_id = state["dataset_id"]
    version = state.get("version")
    user_query = state["user_query"]
    schema_digest = state.get("schema_digest") or quality_service.get_schema_digest(dataset_id, version=version)

    audit = quality_service.get_dataset_audit(dataset_id, version=version)
    col_names = audit.column_names
    dtypes = audit.dtypes

    prompt = f"""Dataset Schema:
{schema_digest}

User Question:
"{user_query}"

Write a valid DuckDB SQL query to answer this analytical question. Table name is '{dataset_id}'."""

    generated_sql = ""
    if client:
        try:
            resp = client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT.format(dataset_id=dataset_id),
                    temperature=0.1
                )
            )
            generated_sql = extract_sql(resp.text)
        except Exception:
            generated_sql = simulate_sql_fallback(user_query, dataset_id, col_names, dtypes)
    else:
        generated_sql = simulate_sql_fallback(user_query, dataset_id, col_names, dtypes)

    return {
        "generated_sql": generated_sql,
        "schema_digest": schema_digest,
        "status": "executing",
        "history": state.get("history", []) + [{"action": "generate_sql", "sql": generated_sql}]
    }


def execute_sql_node(state: AgentState) -> Dict[str, Any]:
    """Node 2: Executes generated SQL on the DuckDB engine."""
    dataset_id = state["dataset_id"]
    version = state.get("version")
    sql = state.get("generated_sql") or f"SELECT * FROM {dataset_id} LIMIT 10"

    result = query_executor.execute_query(dataset_id, sql, version=version)

    return {
        "execution_result": result,
        "error": result.get("error"),
        "status": "self_healing" if result.get("error") else "visualizing",
        "history": state.get("history", []) + [{"action": "execute_sql", "result": result}]
    }


def self_heal_node(state: AgentState) -> Dict[str, Any]:
    """Node 3: Self-healing error correction loop when SQL execution fails."""
    client = get_gemini_client()
    dataset_id = state["dataset_id"]
    version = state.get("version")
    user_query = state["user_query"]
    failed_sql = state.get("generated_sql", "")
    error_msg = state.get("error", "Unknown SQL Error")
    schema_digest = state.get("schema_digest", "")

    audit = quality_service.get_dataset_audit(dataset_id, version=version)
    candidate_cols = audit.column_names

    repair_prompt = REPAIR_PROMPT.format(
        error_msg=error_msg,
        failed_sql=failed_sql,
        schema_digest=schema_digest,
        user_query=user_query,
        dataset_id=dataset_id
    )

    corrected_sql = ""
    if client:
        try:
            resp = client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=repair_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT.format(dataset_id=dataset_id),
                    temperature=0.1
                )
            )
            corrected_sql = extract_sql(resp.text)
        except Exception:
            corrected_sql = auto_repair_column_binder(failed_sql, error_msg, candidate_cols) or simulate_sql_fallback(user_query, dataset_id, candidate_cols, audit.dtypes)
    else:
        corrected_sql = auto_repair_column_binder(failed_sql, error_msg, candidate_cols) or simulate_sql_fallback(user_query, dataset_id, candidate_cols, audit.dtypes)

    return {
        "generated_sql": corrected_sql,
        "retry_count": state.get("retry_count", 0) + 1,
        "self_healed": True,
        "status": "executing",
        "history": state.get("history", []) + [{"action": "self_heal", "fixed_sql": corrected_sql}]
    }


def visualize_and_summarize_node(state: AgentState) -> Dict[str, Any]:
    """Node 4: Builds interactive Plotly specification, executive takeaway markdown, and records run."""
    exec_res = state.get("execution_result", {})
    rows = exec_res.get("rows", [])
    columns = exec_res.get("columns", [])
    query = state["user_query"]
    sql = state.get("generated_sql", "")
    dataset_id = state["dataset_id"]
    version = state.get("version") or 1

    # If query failed even after retries
    if not exec_res.get("success"):
        summary = f"⚠️ **TableTell was unable to execute the query safely**:\n\n`{exec_res.get('error')}`\n\n> 💡 **Notice**: In offline fallback mode, questions are mapped to detected schema patterns. To enable full autonomous AI question-answering across arbitrary complex queries, please set `GEMINI_API_KEY` in `backend/.env`."
        return {
            "summary_markdown": summary,
            "plotly_spec": None,
            "status": "completed"
        }

    # Build responsive Plotly chart specification
    plotly_spec = build_plotly_spec(rows, columns, query)

    # Generate executive summary takeaway
    client = get_gemini_client()
    summary = ""
    if client and len(rows) > 0:
        try:
            sample_data_str = json.dumps(rows[:8], default=str)
            sum_prompt = SUMMARY_PROMPT.format(
                user_query=query,
                sql=sql,
                sample_data_str=sample_data_str
            )
            resp = client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=sum_prompt
            )
            summary = resp.text.strip()
        except Exception:
            top_row = rows[0]
            summary = f"Query executed successfully returning **{len(rows)} records**. Top record: **{top_row}**."
    else:
        top_row = rows[0] if rows else {}
        first_col = columns[0] if columns else "N/A"
        summary = f"Query returned **{len(rows)} records** across {len(columns)} dimensions. Top entry: **{top_row.get(first_col)}**."

    # Record run in metadata repository
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    metadata_repo.record_analytical_run(
        run_id=run_id,
        dataset_id=dataset_id,
        dataset_version=version,
        user_query=query,
        generated_sql=sql,
        validation_status="valid",
        execution_duration_ms=exec_res.get("duration_ms", 0.0),
        row_count=exec_res.get("row_count", 0),
        columns=columns,
        chart_spec=plotly_spec,
        summary_markdown=summary,
        error=None
    )

    return {
        "summary_markdown": summary,
        "plotly_spec": plotly_spec,
        "status": "completed",
        "run_id": run_id
    }
