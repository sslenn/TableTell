"""
Analytics Service for TableTell.
Coordinates natural-language queries, SQL generation, validation, execution,
Plotly chart synthesis, and run persistence.
"""

import json
import uuid
from typing import Dict, Any, Optional
from app.storage.metadata_repo import metadata_repo
from app.services.quality_service import quality_service
from app.analytics.sql_generator import generate_sql, auto_repair_column_binder, get_gemini_client
from app.analytics.executor import query_executor
from app.analytics.visualization import build_plotly_spec
from app.analytics.insights_engine import synthesize_executive_briefing
from app.schemas.analytics import ChatResponsePayload, TableResult
from app.core.config import settings


class AnalyticsService:
    def process_query(
        self,
        dataset_id: str,
        user_query: str,
        version: Optional[int] = None,
        max_retries: int = 2
    ) -> ChatResponsePayload:
        """
        End-to-end execution of analytical query:
        1. Digest schema
        2. Generate SQL
        3. Execute with DuckDB
        4. Self-heal if needed
        5. Build Plotly specification
        6. Synthesize executive summary
        7. Persist run trace in SQLite
        """
        audit = quality_service.get_dataset_audit(dataset_id, version=version)
        schema_digest = quality_service.get_schema_digest(dataset_id, version=version)
        col_names = audit.column_names
        dtypes = audit.dtypes

        # 1. Generate SQL
        sql = generate_sql(user_query, dataset_id, schema_digest, col_names, dtypes)
        
        # 2. Execute SQL
        exec_res = query_executor.execute_query(dataset_id, sql, version=version)
        
        self_healed = False
        retries = 0

        # 3. Self-healing loop if failed
        while not exec_res.get("success") and retries < max_retries:
            retries += 1
            error_msg = exec_res.get("error", "")
            repaired_sql = auto_repair_column_binder(sql, error_msg, col_names)
            if not repaired_sql:
                break
            sql = repaired_sql
            exec_res = query_executor.execute_query(dataset_id, sql, version=version)
            if exec_res.get("success"):
                self_healed = True
                break

        rows = exec_res.get("rows", [])
        columns = exec_res.get("columns", [])

        # 4. Synthesize Plotly visualization
        chart_spec = build_plotly_spec(rows, columns, user_query) if exec_res.get("success") else None

        # 5. Synthesize Executive takeaway summary
        summary = self._generate_summary(user_query, sql, rows, columns, dataset_id, exec_res.get("error"))

        # 6. Record run in metadata repository
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        actual_version = version or audit.version
        metadata_repo.record_analytical_run(
            run_id=run_id,
            dataset_id=dataset_id,
            dataset_version=actual_version,
            user_query=user_query,
            generated_sql=sql,
            validation_status="valid" if exec_res.get("success") else "error",
            execution_duration_ms=exec_res.get("duration_ms", 0.0),
            row_count=exec_res.get("row_count", 0),
            columns=columns,
            chart_spec=chart_spec,
            summary_markdown=summary,
            error=exec_res.get("error")
        )

        table_result = TableResult(
            columns=columns,
            rows=rows,
            row_count=exec_res.get("row_count", 0),
            duration_ms=exec_res.get("duration_ms", 0.0)
        )

        return ChatResponsePayload(
            status="success" if exec_res.get("success") else "error",
            summary=summary,
            sql=sql,
            plotly_spec=chart_spec,
            table=table_result,
            self_healed=self_healed,
            retries=retries,
            dataset_id=dataset_id,
            version=actual_version,
            run_id=run_id
        )

    def _generate_summary(
        self,
        query: str,
        sql: str,
        rows: list,
        columns: list,
        dataset_id: str,
        error: Optional[str]
    ) -> str:
        return synthesize_executive_briefing(
            user_query=query,
            sql=sql,
            rows=rows,
            columns=columns,
            dataset_id=dataset_id,
            error=error
        )


analytics_service = AnalyticsService()
