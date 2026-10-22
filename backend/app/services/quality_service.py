"""
Quality Service for TableTell.
Coordinates dataset profiling, multi-dimensional health scoring, and schema digests.
"""

from typing import Dict, Any, Optional
from app.storage.parquet_store import parquet_store
from app.storage.metadata_repo import metadata_repo
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine
from app.schemas.quality import DatasetAuditReport


class QualityService:
    def get_dataset_audit(self, dataset_id: str, version: Optional[int] = None, force_recompute: bool = False) -> DatasetAuditReport:
        """
        Retrieves or computes comprehensive quality audit and health score.
        Uses cached report from SQLite if available and not forced to recompute.
        """
        # Check cached version report
        if not force_recompute and version is not None:
            v_data = metadata_repo.get_version(dataset_id, version)
            if v_data and v_data.get("quality_report"):
                return DatasetAuditReport(**v_data["quality_report"])

        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)
        profile = dataset_profiler.profile_parquet(parquet_path)
        audit = quality_scoring_engine.evaluate_quality(profile, dataset_id, version=version or 1)

        # Update cache in metadata repo if version exists
        if version:
            v_data = metadata_repo.get_version(dataset_id, version)
            if v_data:
                metadata_repo.create_version(
                    dataset_id=dataset_id,
                    version=version,
                    storage_path=str(parquet_path),
                    row_count=profile["total_rows"],
                    col_count=profile["total_cols"],
                    size_bytes=parquet_path.stat().st_size,
                    schema={"columns": profile["column_names"], "dtypes": profile["dtypes"]},
                    profiling=profile,
                    quality_score=audit.data_health_score,
                    quality_report=audit.model_dump(),
                    changelog=v_data.get("changelog", [])
                )

        return audit

    def get_schema_digest(self, dataset_id: str, version: Optional[int] = None, max_cols: int = 30) -> str:
        """
        Produces a compact, prompt-friendly schema summary for LLM context.
        """
        audit = self.get_dataset_audit(dataset_id, version=version)
        lines = [
            f"Table Name: '{dataset_id}'",
            f"Total Rows: {audit.total_rows:,} | Total Columns: {audit.total_cols}",
            "Columns & Sample Data:"
        ]

        for col in audit.columns[:max_cols]:
            sample_str = ", ".join(f"'{v}'" if isinstance(v, str) else str(v) for v in col.sample_values) if col.sample_values else "N/A"
            lines.append(f"- `{col.column_name}` ({col.data_type}): Samples: [{sample_str}]")

        return "\n".join(lines)


quality_service = QualityService()
