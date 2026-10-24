"""
Parquet & Raw Data Storage Manager for TableTell
Handles safe path resolution, file immutability, and storage isolation.
"""

from pathlib import Path
import re
from typing import Optional, List
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

    def delete_dataset_files(self, dataset_id: str) -> List[str]:
        """
        Safely deletes all physical files associated with a dataset from the data lake:
        - Raw uploads in data_lake/raw/{dataset_id}.*
        - Processed version parquets in data_lake/processed/{dataset_id}_v*.parquet
        - Direct lake parquets/files in data_lake/{dataset_id}.*
        """
        safe_id = self.sanitize_id(dataset_id)
        deleted = []

        # 1. Raw uploads
        for p in self.raw_dir.glob(f"{safe_id}.*"):
            if p.is_file():
                try:
                    p.unlink()
                    deleted.append(str(p))
                except Exception:
                    pass

        # 2. Processed version files
        for p in self.processed_dir.glob(f"{safe_id}_v*.parquet"):
            if p.is_file():
                try:
                    p.unlink()
                    deleted.append(str(p))
                except Exception:
                    pass

        # 3. Direct base lake files
        for p in self.base_dir.glob(f"{safe_id}.*"):
            if p.is_file() and p.suffix.lower() in (".parquet", ".csv", ".xlsx", ".json"):
                try:
                    p.unlink()
                    deleted.append(str(p))
                except Exception:
                    pass

        return deleted

    def rename_dataset_files(self, old_dataset_id: str, new_dataset_id: str) -> List[str]:
        """
        Safely renames physical files associated with old_dataset_id to new_dataset_id in the data lake:
        - Raw uploads in data_lake/raw/{old_id}.* -> {new_id}.*
        - Processed version parquets in data_lake/processed/{old_id}_v*.parquet -> {new_id}_v*.parquet
        - Direct lake parquets/files in data_lake/{old_id}.* -> {new_id}.*
        """
        old_safe = self.sanitize_id(old_dataset_id)
        new_safe = self.sanitize_id(new_dataset_id)

        # Pre-check collisions
        for p in self.raw_dir.glob(f"{old_safe}.*"):
            if p.is_file():
                ext = p.suffix
                if (self.raw_dir / f"{new_safe}{ext}").exists():
                    raise FileExistsError(f"Target raw file already exists: {new_safe}{ext}")

        for p in self.processed_dir.glob(f"{old_safe}_v*.parquet"):
            if p.is_file():
                new_filename = p.name.replace(f"{old_safe}_v", f"{new_safe}_v", 1)
                if (self.processed_dir / new_filename).exists():
                    raise FileExistsError(f"Target processed parquet already exists: {new_filename}")

        for p in self.base_dir.glob(f"{old_safe}.*"):
            if p.is_file() and p.suffix.lower() in (".parquet", ".csv", ".xlsx", ".json"):
                new_filename = f"{new_safe}{p.suffix}"
                if (self.base_dir / new_filename).exists():
                    raise FileExistsError(f"Target data lake file already exists: {new_filename}")

        renamed_pairs = []
        try:
            # 1. Raw uploads
            for p in list(self.raw_dir.glob(f"{old_safe}.*")):
                if p.is_file():
                    ext = p.suffix
                    target = self.raw_dir / f"{new_safe}{ext}"
                    p.rename(target)
                    renamed_pairs.append((target, p))

            # 2. Processed version files
            for p in list(self.processed_dir.glob(f"{old_safe}_v*.parquet")):
                if p.is_file():
                    new_filename = p.name.replace(f"{old_safe}_v", f"{new_safe}_v", 1)
                    target = self.processed_dir / new_filename
                    p.rename(target)
                    renamed_pairs.append((target, p))

            # 3. Direct base lake files
            for p in list(self.base_dir.glob(f"{old_safe}.*")):
                if p.is_file() and p.suffix.lower() in (".parquet", ".csv", ".xlsx", ".json"):
                    target = self.base_dir / f"{new_safe}{p.suffix}"
                    p.rename(target)
                    renamed_pairs.append((target, p))

            return [str(t) for t, _ in renamed_pairs]
        except Exception as e:
            # Rollback any files that were already moved
            for target, original in renamed_pairs:
                try:
                    if target.exists():
                        target.rename(original)
                except Exception:
                    pass
            raise IOError(f"Failed to rename storage files for dataset '{old_dataset_id}' to '{new_dataset_id}': {str(e)}")

    def _ensure_safe_path(self, path: Path):
        try:
            path.resolve().relative_to(self.base_dir.resolve())
        except ValueError:
            raise PermissionError(f"Access outside data lake sandbox denied: {path}")


parquet_store = ParquetStore()
