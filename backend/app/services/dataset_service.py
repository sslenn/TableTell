"""
Dataset Service for TableTell.
Coordinates ingestion, metadata synchronization, catalog caching, and version tracking.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import uuid
import re
import numpy as np
import pandas as pd
from app.core.config import settings
from app.core.exceptions import DatasetNotFoundError
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store
from app.ingestion.csv_reader import ingest_file_to_storage
from app.ingestion.validation import validate_upload_file
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine


class DatasetService:
    def __init__(self):
        self._sync_existing_datasets()

    PUBLIC_BENCHMARK_IDS = {
        "ecommerce_sales",
        "retail_superstore_sales",
        "saas_subscription_financials",
        "customer_churn_telecom",
        "saas_churn",
        "online_retail",
    }

    def _sync_existing_datasets(self):
        """
        Auto-registers official benchmark datasets in the data lake into SQLite metadata storage.
        Guarantees that built-in benchmark tables are immediately available as 'public'
        without accidentally exposing user-uploaded or user-cleaned files.
        """
        self._ensure_benchmark_datasets_exist()

        parquet_files = list(settings.DATA_LAKE_DIR.glob("*.parquet"))
        for p in parquet_files:
            d_id = p.stem
            if d_id not in self.PUBLIC_BENCHMARK_IDS:
                continue
            existing = metadata_repo.get_dataset(d_id)
            if not existing:
                try:
                    # Initial profiling
                    profile = dataset_profiler.profile_parquet(p)
                    audit = quality_scoring_engine.evaluate_quality(profile, d_id, version=1)

                    metadata_repo.create_dataset(
                        dataset_id=d_id,
                        name=d_id.replace("_", " ").title(),
                        original_filename=p.name,
                        source_format="parquet",
                        raw_storage_path=str(p),
                        description=f"Auto-discovered benchmark dataset from {p.name}",
                        owner_id="public"
                    )
                    metadata_repo.create_version(
                        dataset_id=d_id,
                        version=1,
                        storage_path=str(p),
                        row_count=profile["total_rows"],
                        col_count=profile["total_cols"],
                        size_bytes=p.stat().st_size,
                        schema={"columns": profile["column_names"], "dtypes": profile["dtypes"]},
                        profiling=profile,
                        quality_score=audit.data_health_score,
                        quality_report=audit.model_dump(),
                        changelog=["Initial baseline ingestion."]
                    )
                except Exception:
                    continue

    def list_datasets(self, owner_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns all registered datasets visible to `owner_id` (public benchmark datasets + user's own uploads)
        with pre-computed cached health scores and metrics.
        """
        datasets = metadata_repo.list_datasets(owner_id=owner_id)
        # Format for exact frontend compatibility
        formatted = []
        for d in datasets:
            formatted.append({
                "dataset_id": d["id"],
                "filename": d.get("original_filename") or f"{d['id']}.parquet",
                "total_rows": d.get("row_count", 0),
                "total_cols": d.get("col_count", 0),
                "data_health_score": d.get("quality_score", 100),
                "size_kb": d.get("size_kb", 0.0),
                "current_version": d.get("current_version", 1),
                "source_format": d.get("source_format", "csv"),
                "owner_id": d.get("owner_id", "public")
            })
        return formatted

    def get_dataset_detail(self, dataset_id: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
        d = metadata_repo.get_dataset(dataset_id, owner_id=owner_id)
        if not d:
            raise DatasetNotFoundError(dataset_id)
        versions = metadata_repo.list_versions(dataset_id)
        d["versions"] = versions
        return d

    def delete_dataset(self, dataset_id: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Deletes a dataset and all associated versions, files, and metadata:
        1. Checks existence & ownership
        2. Deletes physical raw and processed parquet files
        3. Cascades deletion in SQLite metadata repository
        """
        d = metadata_repo.get_dataset(dataset_id, owner_id=owner_id)
        if not d:
            raise DatasetNotFoundError(dataset_id)

        ds_owner = d.get("owner_id", "public")
        if owner_id and owner_id not in ("local_analyst", "public") and ds_owner != owner_id:
            raise PermissionError(f"Cannot delete shared benchmark dataset '{dataset_id}'.")

        deleted_files = []

        # Remove explicit version files
        versions = metadata_repo.list_versions(dataset_id)
        for v in versions:
            sp = v.get("storage_path")
            if sp:
                p = Path(sp)
                if p.exists() and p.is_file():
                    try:
                        p.unlink()
                        deleted_files.append(str(p))
                    except Exception:
                        pass

        # Remove raw storage path if specified
        raw_sp = d.get("raw_storage_path")
        if raw_sp:
            rp = Path(raw_sp)
            if rp.exists() and rp.is_file():
                try:
                    rp.unlink()
                    deleted_files.append(str(rp))
                except Exception:
                    pass

        # Purge any matched lake files
        additional_deleted = parquet_store.delete_dataset_files(dataset_id)
        deleted_files.extend(additional_deleted)

        # Remove dataset and all versions from SQLite
        metadata_repo.delete_dataset(dataset_id)

        return {
            "status": "success",
            "dataset_id": dataset_id,
            "deleted_files_count": len(set(deleted_files)),
            "message": f"Dataset '{dataset_id}' and all associated files deleted successfully"
        }

    def rename_dataset(self, old_dataset_id: str, new_name: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Renames an existing dataset across physical files, SQLite metadata, and DuckDB views.
        """
        if not new_name or not new_name.strip():
            raise ValueError("New dataset name cannot be empty")

        old_id = old_dataset_id.strip()
        d = metadata_repo.get_dataset(old_id, owner_id=owner_id)
        if not d:
            raise DatasetNotFoundError(old_id)

        ds_owner = d.get("owner_id", "public")
        if owner_id and owner_id not in ("local_analyst", "public") and ds_owner != owner_id:
            raise PermissionError(f"Cannot rename shared benchmark dataset '{old_id}'.")

        # Sanitize new_name into a valid dataset identifier
        raw = new_name.strip()
        base_raw = raw.rsplit(".", 1)[0] if "." in raw else raw
        safe_new_id = re.sub(r"[^a-zA-Z0-9_]", "_", base_raw).strip("_").lower()
        if not safe_new_id:
            raise ValueError(f"Invalid dataset name '{new_name}'. Must contain alphanumeric characters.")

        if safe_new_id == old_id:
            return {
                "status": "success",
                "old_dataset_id": old_id,
                "new_dataset_id": old_id,
                "message": f"Dataset name is unchanged ('{old_id}')",
                "dataset": d
            }

        # Check for ID collision
        existing = metadata_repo.get_dataset(safe_new_id)
        if existing:
            raise ValueError(f"A dataset with name '{safe_new_id}' already exists")

        # 1. Rename physical files in data lake
        renamed_files = parquet_store.rename_dataset_files(old_id, safe_new_id)

        # 2. Update SQLite metadata
        updated_meta = metadata_repo.rename_dataset(
            old_dataset_id=old_id,
            new_dataset_id=safe_new_id,
            new_name=raw.replace("_", " ").title()
        )

        # 3. Synchronize DuckDB registered views
        try:
            from app.analytics.executor import query_executor
            query_executor.conn.execute(f'DROP VIEW IF EXISTS "{old_id}"')
            new_parquet_path = parquet_store.resolve_dataset_path(safe_new_id)
            query_executor.register_dataset_view(safe_new_id, new_parquet_path)
        except Exception:
            pass

        return {
            "status": "success",
            "old_dataset_id": old_id,
            "new_dataset_id": safe_new_id,
            "renamed_files_count": len(renamed_files),
            "message": f"Dataset '{old_id}' successfully renamed to '{safe_new_id}'",
            "dataset": updated_meta
        }

    def upload_dataset(
        self,
        file_content: bytes,
        filename: str,
        custom_name: Optional[str] = None,
        owner_id: str = "public"
    ) -> Dict[str, Any]:
        """
        Ingests uploaded file:
        - Validates file
        - Stores raw file immutably in data_lake/raw/
        - Converts to clean Parquet in data_lake/processed/
        - Runs initial profile and quality audit
        - Persists metadata and version 1 in SQLite scoped to `owner_id`
        """
        validate_upload_file(filename, len(file_content))

        # Generate stable dataset ID
        raw_name = custom_name or filename or "dataset"
        base_name = raw_name.rsplit(".", 1)[0]
        safe_id = re.sub(r"[^a-zA-Z0-9_]", "_", base_name).strip("_").lower()
        if not safe_id:
            safe_id = f"data_{uuid.uuid4().hex[:8]}"

        # Check collision: if ID exists, generate a unique suffix for the new dataset
        existing = metadata_repo.get_dataset(safe_id)
        if existing:
            safe_id = f"{safe_id}_{uuid.uuid4().hex[:6]}"

        ext = Path(filename).suffix.lstrip(".") or "csv"

        raw_path, v1_parquet_path, df = ingest_file_to_storage(
            file_content=file_content,
            filename=filename,
            dataset_id=safe_id
        )

        # Profile & evaluate initial quality
        profile = dataset_profiler.profile_parquet(v1_parquet_path)
        audit = quality_scoring_engine.evaluate_quality(profile, safe_id, version=1)

        # Register dataset in SQLite
        metadata_repo.create_dataset(
            dataset_id=safe_id,
            name=custom_name or base_name.replace("_", " ").title(),
            original_filename=filename,
            source_format=ext,
            raw_storage_path=str(raw_path),
            description=f"Uploaded {filename}",
            owner_id=owner_id or "public"
        )

        metadata_repo.create_version(
            dataset_id=safe_id,
            version=1,
            storage_path=str(v1_parquet_path),
            row_count=profile["total_rows"],
            col_count=profile["total_cols"],
            size_bytes=v1_parquet_path.stat().st_size,
            schema={"columns": profile["column_names"], "dtypes": profile["dtypes"]},
            profiling=profile,
            quality_score=audit.data_health_score,
            quality_report=audit.model_dump(),
            changelog=["Initial raw file ingestion."]
        )

        return {
            "dataset_id": safe_id,
            "filename": filename,
            "total_rows": profile["total_rows"],
            "total_cols": profile["total_cols"],
            "columns": profile["column_names"],
            "column_stats": audit.columns,
            "data_health_score": audit.data_health_score,
            "parquet_path": str(v1_parquet_path)
        }

    def _ensure_benchmark_datasets_exist(self):
        """Creates benchmark datasets if they don't exist yet."""
        retail_path = settings.DATA_LAKE_DIR / "retail_superstore_sales.parquet"
        if not retail_path.exists():
            try:
                from app.scripts.seed_data import run_seeder
                run_seeder()
            except Exception as e:
                pass


dataset_service = DatasetService()
