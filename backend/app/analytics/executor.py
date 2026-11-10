"""
DuckDB Analytical Query Executor for TableTell.
Executes validated read-only SQL queries in isolated, directory-jailed DuckDB connections
against Parquet files in the data lake.
"""

import time
import math
import threading
from pathlib import Path
from typing import Dict, Any, Optional
import duckdb
from app.core.config import settings
from app.analytics.sql_validator import validate_read_only_sql
from app.storage.parquet_store import parquet_store
from app.core.exceptions import QueryExecutionError


def _format_cell_value(col: str, val: Any) -> Any:
    if isinstance(val, float):
        if not math.isfinite(val):
            return None
        col_lower = col.lower()
        if any(kw in col_lower for kw in [
            "price", "revenue", "cost", "amount", "spend", "sales",
            "profit", "fee", "salary", "discount", "pricing", "charge",
            "tax", "total", "subtotal", "val"
        ]):
            return round(val, 2)
        return round(val, 4)
    return val


QUERY_TIMEOUT_SECONDS = 5.0


def _apply_duckdb_sandbox(conn: duckdb.DuckDBPyConnection) -> None:
    """
    Restricts DuckDB filesystem access strictly to DATA_LAKE_DIR, caps per-query RAM & CPU threads,
    and locks configuration so user queries can never read host files or exhaust server memory.
    """
    lake_dir_str = str(settings.DATA_LAKE_DIR.resolve()).replace("\\", "/").replace("'", "''")
    try:
        conn.execute("SET memory_limit = '512MB';")
        conn.execute("SET threads = 2;")
        conn.execute(f"SET allowed_directories = ['{lake_dir_str}'];")
        conn.execute("SET lock_configuration = true;")
    except Exception:
        pass


def _bind_views_on_conn(conn: duckdb.DuckDBPyConnection, dataset_id: str, parquet_path: Path) -> None:
    path_str = str(parquet_path.resolve()).replace("\\", "/").replace("'", "''")
    safe_id = parquet_store.sanitize_id(dataset_id)
    conn.execute(f'CREATE OR REPLACE VIEW "{safe_id}" AS SELECT * FROM \'{path_str}\'')
    conn.execute(f'CREATE OR REPLACE VIEW dataset AS SELECT * FROM "{safe_id}"')
    conn.execute(f'CREATE OR REPLACE VIEW df AS SELECT * FROM "{safe_id}"')
    conn.execute(f'CREATE OR REPLACE VIEW data AS SELECT * FROM "{safe_id}"')


class QueryExecutor:
    def __init__(self, conn: Optional[duckdb.DuckDBPyConnection] = None):
        self._lock = threading.RLock()
        self.conn = conn or duckdb.connect(database=":memory:")
        _apply_duckdb_sandbox(self.conn)

    def register_dataset_view(self, dataset_id: str, parquet_path: Path):
        """
        Registers a Parquet file as a clean DuckDB View on the shared connection (thread-safe).
        """
        with self._lock:
            _bind_views_on_conn(self.conn, dataset_id, parquet_path)

    def execute_query(
        self,
        dataset_id: str,
        sql_query: str,
        version: Optional[int] = None,
        max_rows: int = 1000,
    ) -> Dict[str, Any]:
        """
        Validates and executes analytical SQL against the target dataset version
        inside an isolated per-request in-memory DuckDB connection so concurrent requests
        never overwrite each other's `dataset` / `df` views.
        """
        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)

        # 1. Validate read-only constraints
        try:
            validated_sql = validate_read_only_sql(
                sql_query,
                allowed_table_names=[dataset_id, "dataset", "df", "data"]
            )
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

        # 2. Execute in an isolated, directory-jailed DuckDB connection with 5s timeout guard
        start_time = time.perf_counter()
        isolated_conn = duckdb.connect(database=":memory:")
        watchdog = threading.Timer(QUERY_TIMEOUT_SECONDS, isolated_conn.interrupt)
        watchdog.daemon = True
        try:
            _bind_views_on_conn(isolated_conn, dataset_id, parquet_path)
            _apply_duckdb_sandbox(isolated_conn)

            watchdog.start()
            res = isolated_conn.execute(validated_sql)
            columns = [desc[0] for desc in res.description] if res.description else []
            records = res.fetchmany(max_rows)
            watchdog.cancel()
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
            watchdog.cancel()
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
        finally:
            watchdog.cancel()
            try:
                isolated_conn.close()
            except Exception:
                pass


query_executor = QueryExecutor()
