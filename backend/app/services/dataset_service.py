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

    def _sync_existing_datasets(self):
        """
        Auto-registers existing benchmark datasets in the data lake into SQLite metadata storage.
        Guarantees that files like ecommerce_sales, saas_churn, online_retail are immediately available
        without requiring re-upload.
        """
        self._ensure_benchmark_datasets_exist()

        parquet_files = list(settings.DATA_LAKE_DIR.glob("*.parquet"))
        for p in parquet_files:
            d_id = p.stem
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
                        description=f"Auto-discovered dataset from {p.name}"
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

    def list_datasets(self) -> List[Dict[str, Any]]:
        """
        Returns all registered datasets with pre-computed cached health scores and metrics.
        Eliminates N+1 DuckDB full table scans!
        """
        datasets = metadata_repo.list_datasets()
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
                "source_format": d.get("source_format", "csv")
            })
        return formatted

    def get_dataset_detail(self, dataset_id: str) -> Dict[str, Any]:
        d = metadata_repo.get_dataset(dataset_id)
        if not d:
            raise DatasetNotFoundError(dataset_id)
        versions = metadata_repo.list_versions(dataset_id)
        d["versions"] = versions
        return d

    def delete_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """
        Deletes a dataset and all associated versions, files, and metadata:
        1. Checks existence
        2. Deletes physical raw and processed parquet files
        3. Cascades deletion in SQLite metadata repository
        """
        d = metadata_repo.get_dataset(dataset_id)
        if not d:
            raise DatasetNotFoundError(dataset_id)

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

    def rename_dataset(self, old_dataset_id: str, new_name: str) -> Dict[str, Any]:
        """
        Renames an existing dataset across physical files, SQLite metadata, and DuckDB views.
        """
        if not new_name or not new_name.strip():
            raise ValueError("New dataset name cannot be empty")

        old_id = old_dataset_id.strip()
        d = metadata_repo.get_dataset(old_id)
        if not d:
            raise DatasetNotFoundError(old_id)

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
        custom_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ingests uploaded file:
        - Validates file
        - Stores raw file immutably in data_lake/raw/
        - Converts to clean Parquet in data_lake/processed/
        - Runs initial profile and quality audit
        - Persists metadata and version 1 in SQLite
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
            description=f"Uploaded {filename}"
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
        ecom_path = settings.DATA_LAKE_DIR / "ecommerce_sales.parquet"
        if not ecom_path.exists():
            rng = np.random.default_rng(42)
            n_rows = 5000
            categories = ["Electronics", "Fashion", "Home & Living", "Beauty & Health", "Books"]
            cat_choices = rng.choice(categories, size=n_rows, p=[0.30, 0.25, 0.20, 0.15, 0.10])
            dates = pd.date_range("2026-01-01", "2026-06-30", freq="h")
            prices = {"Electronics": 150.0, "Fashion": 45.0, "Home & Living": 85.0, "Beauty & Health": 30.0, "Books": 22.0}
            unit_prices = [round(prices[c] * rng.uniform(0.7, 1.4), 2) for c in cat_choices]
            quantities = rng.choice([1, 2, 3, 4, 5], size=n_rows)
            discounts = rng.choice([0.0, 0.05, 0.10, 0.15, 0.20], size=n_rows)
            revenue = [round(p * q * (1 - d), 2) for p, q, d in zip(unit_prices, quantities, discounts)]

            df = pd.DataFrame({
                "order_id": [f"ORD-{i:05d}" for i in range(1001, 1001 + n_rows)],
                "order_date": rng.choice(dates, size=n_rows),
                "product_category": cat_choices,
                "unit_price_usd": unit_prices,
                "quantity": quantities,
                "discount_pct": [round(d * 100, 1) for d in discounts],
                "revenue_usd": revenue,
                "country": rng.choice(["United States", "Germany", "United Kingdom", "Japan", "Singapore"], size=n_rows),
                "delivery_status": rng.choice(["Delivered", "Shipped", "Processing", "Cancelled"], size=n_rows, p=[0.75, 0.15, 0.07, 0.03])
            })
            df.to_parquet(ecom_path, engine="pyarrow", index=False)


dataset_service = DatasetService()
