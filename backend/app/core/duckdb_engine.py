"""
DuckDB Analytical Engine for TableTell V2
High-performance in-process columnar SQL processing on local Parquet files.
Acts as a backward-compatible adapter delegating to modular services.
"""

from pathlib import Path
from typing import Dict, Any, Optional
import duckdb
from app.core.config import settings
from app.storage.parquet_store import parquet_store
from app.storage.metadata_repo import metadata_repo
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine
from app.analytics.executor import query_executor
from app.ingestion.schema_inference import normalize_column_name
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service


class DuckDBEngine:
    def __init__(self, data_lake_dir: Optional[Path] = None):
        self.data_lake_dir = data_lake_dir or settings.DATA_LAKE_DIR
        self.conn = query_executor.conn

    def get_parquet_path(self, dataset_id: str) -> Path:
        """Returns the safe absolute path to the Parquet file for this dataset."""
        try:
            return parquet_store.resolve_dataset_path(dataset_id)
        except Exception:
            return parquet_store.get_legacy_parquet_path(dataset_id)

    def normalize_column_name(self, col: str) -> str:
        """Standardizes column names to clean, SQL-friendly snake_case."""
        return normalize_column_name(col)

    def ingest_file(self, file_content: bytes, filename: str, dataset_id: str) -> Dict[str, Any]:
        """
        Converts uploaded CSV or Excel file into a high-performance Parquet file.
        Returns metadata: row_count, col_count, columns, file_size_bytes.
        """
        return dataset_service.upload_dataset(
            file_content=file_content,
            filename=filename,
            custom_name=dataset_id
        )

    def audit_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """
        Vectorized data health audit using DuckDB SQL and multi-dimensional quality scoring.
        """
        audit = quality_service.get_dataset_audit(dataset_id)
        return audit.model_dump()

    def execute_query(self, dataset_id: str, sql_query: str, max_rows: int = 500) -> Dict[str, Any]:
        """
        Safely executes analytical SQL on the dataset's Parquet file using registered DuckDB Views.
        """
        return query_executor.execute_query(
            dataset_id=dataset_id,
            sql_query=sql_query,
            max_rows=max_rows
        )

    def get_schema_digest(self, dataset_id: str, max_cols: int = 30) -> str:
        """
        Produces a compact, prompt-friendly schema summary for LangGraph.
        """
        return quality_service.get_schema_digest(dataset_id, max_cols=max_cols)


# Global singleton instance
duckdb_engine = DuckDBEngine()
