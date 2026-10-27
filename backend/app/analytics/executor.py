"""
DuckDB Analytical Query Executor for TableTell.
Executes validated read-only SQL queries via registered views against Parquet files.
"""

import time
import math
from pathlib import Path
from typing import Dict, Any, Optional
import duckdb
from app.analytics.sql_validator import validate_read_only_sql
from app.storage.parquet_store import parquet_store
from app.core.exceptions import QueryExecutionError


def _format_cell_value(col: str, val: Any) -> Any:
    if isinstance(val, float):
        if not math.isfinite(val):
            return None
        col_lower = col.lower()
        if any(kw in col_lower for kw in ["price", "revenue", "cost", "amount", "spend", "sales", "profit", "fee", "salary", "discount", "pricing", "charge", "tax", "total", "subtotal", "val"]):
            return round(val, 2)
        return round(val, 4)
    return val


class QueryExecutor:
    def __init__(self, conn: Optional[duckdb.DuckDBPyConnection] = None):
        self.conn = conn or duckdb.connect(database=":memory:")

    def register_dataset_view(self, dataset_id: str, parquet_path: Path):
        """
        Registers a Parquet file as a clean DuckDB View.
        Eliminates regex string table replacement!
        """
        path_str = str(parquet_path).replace("\\", "/")
        safe_id = parquet_store.sanitize_id(dataset_id)
        
        # Register main table view and common aliases
        self.conn.execute(f'CREATE OR REPLACE VIEW "{safe_id}" AS SELECT * FROM \'{path_str}\'')
        self.conn.execute(f'CREATE OR REPLACE VIEW dataset AS SELECT * FROM "{safe_id}"')
        self.conn.execute(f'CREATE OR REPLACE VIEW df AS SELECT * FROM "{safe_id}"')
        self.conn.execute(f'CREATE OR REPLACE VIEW data AS SELECT * FROM "{safe_id}"')

    def execute_query(
        self,
        dataset_id: str,
        sql_query: str,
        version: Optional[int] = None,
        max_rows: int = 1000,
    ) -> Dict[str, Any]:
        """
        Validates and executes analytical SQL against the target dataset version.
        """
        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)
        self.register_dataset_view(dataset_id, parquet_path)

        # 1. Validate read-only constraints
        try:
            validated_sql = validate_read_only_sql(sql_query, allowed_table_names=[dataset_id, "dataset", "df", "data"])
        except Exception as e:
            return {
                "success": False,
                "sql": sql_query,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "duration_ms": 0.0,
                "error": f"Validation Error: {str(e)}"
            }

        # 2. Execute with timing
        start_time = time.perf_counter()
        try:
            res = self.conn.execute(validated_sql)
            columns = [desc[0] for desc in res.description] if res.description else []
            records = res.fetchmany(max_rows)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            rows = [{col: _format_cell_value(col, val) for col, val in zip(columns, row)} for row in records]

            return {
                "success": True,
                "sql": validated_sql,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "duration_ms": duration_ms,
                "error": None
            }
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "sql": validated_sql,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "duration_ms": duration_ms,
                "error": f"{type(e).__name__}: {str(e)}"
            }


query_executor = QueryExecutor()
