"""
Parquet & Raw Data Storage Manager for TableTell
Handles safe path resolution, file immutability, and storage isolation.
"""

from pathlib import Path
import re
from typing import Optional
from app.core.config import settings
from app.core.exceptions import DatasetNotFoundError


class ParquetStore:
    def __init__(self, base_lake_dir: Optional[Path] = None):
        self.base_dir = base_lake_dir or settings.DATA_LAKE_DIR
        self.raw_dir = settings.RAW_DIR
        self.processed_dir = settings.PROCESSED_DIR
        
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def sanitize_id(self, dataset_id: str) -> str:
        safe = re.sub(r"[^a-zA-Z0-9_\-]", "", dataset_id)
        if not safe:
            raise ValueError(f"Invalid dataset_id: '{dataset_id}'")
        return safe

    def get_raw_path(self, dataset_id: str, extension: str = "csv") -> Path:
        safe_id = self.sanitize_id(dataset_id)
        clean_ext = extension.lstrip(".")
        target = (self.raw_dir / f"{safe_id}.{clean_ext}").resolve()
        self._ensure_safe_path(target)
        return target

    def get_version_parquet_path(self, dataset_id: str, version: int = 1) -> Path:
        safe_id = self.sanitize_id(dataset_id)
        target = (self.processed_dir / f"{safe_id}_v{version}.parquet").resolve()
        self._ensure_safe_path(target)
        return target

    def get_legacy_parquet_path(self, dataset_id: str) -> Path:
        safe_id = self.sanitize_id(dataset_id)
        target = (self.base_dir / f"{safe_id}.parquet").resolve()
        self._ensure_safe_path(target)
        return target

    def resolve_dataset_path(self, dataset_id: str, version: Optional[int] = None) -> Path:
        """
        Resolves the exact parquet file path for a dataset:
        1. If explicit version requested: processed_dir/{id}_v{version}.parquet
        2. If exists in processed_dir: highest version or v1
        3. If exists in base_dir: base_dir/{id}.parquet (legacy benchmark datasets)
        """
        safe_id = self.sanitize_id(dataset_id)

        if version is not None:
            v_path = self.get_version_parquet_path(safe_id, version)
            if v_path.exists():
                return v_path
            # Check legacy naming
            if version == 1:
                leg_path = self.get_legacy_parquet_path(safe_id)
                if leg_path.exists():
                    return leg_path
            raise DatasetNotFoundError(f"{safe_id} (version {version})")

        # Check latest version in processed_dir
        version_files = sorted(self.processed_dir.glob(f"{safe_id}_v*.parquet"))
        if version_files:
            return version_files[-1]

        # Check root data_lake (e.g. ecommerce_sales.parquet)
        leg_path = self.get_legacy_parquet_path(safe_id)
        if leg_path.exists():
            return leg_path

        raise DatasetNotFoundError(dataset_id)

    def _ensure_safe_path(self, path: Path):
        try:
            path.resolve().relative_to(self.base_dir.resolve())
        except ValueError:
            raise PermissionError(f"Access outside data lake sandbox denied: {path}")


parquet_store = ParquetStore()
