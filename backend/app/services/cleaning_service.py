"""
Data Cleaning & Transformation Service for TableTell.
Coordinates:
1. Explainable cleaning recommendations & review plans.
2. User-approved transformations with before/after regression validation.
3. Dataset version creation (v1 -> v2) with backward-compatible legacy aliases.
4. Preserves functional and OOP transformer interfaces.
"""

from abc import ABC, abstractmethod
from typing import Tuple, List, Dict, Any, Optional
from pathlib import Path
import re
import pandas as pd
import numpy as np

from app.core.config import settings
from app.core.exceptions import DatasetNotFoundError, CleaningPlanError
from app.storage.parquet_store import parquet_store
from app.storage.metadata_repo import metadata_repo
from app.cleaning.transformers import (
    BaseTransformer,
    TRANSFORMER_REGISTRY,
    DropDuplicatesTransformer,
    DropMissingIdentifiersTransformer,
    StandardizeDatesTransformer,
    CleanQuantitiesTransformer,
    ImputeMissingValuesTransformer,
    NormalizeHeadersTransformer,
    StandardizeCategoriesTransformer,
    MergeCategoriesTransformer,
)
from app.cleaning.planner import cleaning_planner
from app.cleaning.validation import validate_transformed_data
from app.schemas.cleaning import CleaningPlan, CleaningResult
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine


# =====================================================================
# 1. FUNCTIONAL API (Preserved for compatibility)
# =====================================================================

def drop_missing_values(df: pd.DataFrame, subset: Optional[List[str]] = None) -> pd.DataFrame:
    transformer = DropMissingIdentifiersTransformer()
    res_df, _ = transformer.transform(df, {"subset": subset or []})
    return res_df


def standardize_dates(df: pd.DataFrame, date_col: Optional[str] = None) -> pd.DataFrame:
    transformer = StandardizeDatesTransformer()
    res_df, _ = transformer.transform(df, {"date_col": date_col})
    return res_df


def clean_quantities(df: pd.DataFrame, qty_col: Optional[str] = None) -> pd.DataFrame:
    transformer = CleanQuantitiesTransformer()
    res_df, _ = transformer.transform(df, {"qty_col": qty_col})
    return res_df


def remove_duplicates(df: pd.DataFrame, subset_cols: Optional[List[str]] = None) -> pd.DataFrame:
    transformer = DropDuplicatesTransformer()
    res_df, _ = transformer.transform(df, {"subset": subset_cols or []})
    return res_df


def transform_data(df: pd.DataFrame) -> pd.DataFrame:
    pipeline = DataCleaningPipeline()
    return pipeline.clean_dataframe(df)[0]


# =====================================================================
# 2. OOP PIPELINE PATTERN (Preserved for compatibility)
# =====================================================================

class BaseCleaningStep(ABC):
    @abstractmethod
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        pass


class MissingValueStep(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = DropMissingIdentifiersTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class DateStandardizerStep(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = StandardizeDatesTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class QuantityCleanerStep(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = CleanQuantitiesTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class HeaderNormalizer(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = NormalizeHeadersTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class DuplicateRemoverStep(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = DropDuplicatesTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class MissingValueImputer(BaseCleaningStep):
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        t = ImputeMissingValuesTransformer()
        res_df, msg = t.transform(df)
        return res_df, [msg] if msg else []


class DataCleaningPipeline:
    def __init__(self, steps: Optional[List[BaseCleaningStep]] = None):
        self.steps = steps or [
            MissingValueStep(),
            DateStandardizerStep(),
            QuantityCleanerStep(),
            HeaderNormalizer(),
            DuplicateRemoverStep(),
            MissingValueImputer(),
        ]

    def clean_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        changelog = []
        for step in self.steps:
            df, logs = step.process(df)
            changelog.extend(logs)
        return df, changelog

    def clean_dataset(
        self,
        dataset_id: str,
        approved_rec_ids: Optional[List[str]] = None,
        description: str = "Auto-cleaned dataset version"
    ) -> Dict[str, Any]:
        """
        Executes cleaning pipeline with:
        1. Safe version creation
        2. Before-and-after statistics
        3. Backward-compatible keys for frontend UI
        """
        # Resolve source parquet
        d_meta = metadata_repo.get_dataset(dataset_id)
        current_version = d_meta["current_version"] if d_meta else 1
        source_path = parquet_store.resolve_dataset_path(dataset_id, version=current_version)

        df_before = pd.read_parquet(source_path)
        original_rows = len(df_before)

        # Audit before cleaning
        profile_before = dataset_profiler.profile_parquet(source_path)
        audit_before = quality_scoring_engine.evaluate_quality(profile_before, dataset_id, version=current_version)

        # If specific recommendation IDs provided, execute only those
        all_changelog = []
        df_after = df_before.copy()

        if approved_rec_ids:
            plan = cleaning_planner.create_plan(audit_before)
            rec_map = {r.recommendation_id: r for r in plan.recommendations}
            for rid in approved_rec_ids:
                rec = rec_map.get(rid)
                if rec:
                    transformer = TRANSFORMER_REGISTRY.get(rec.action_type)
                    if transformer:
                        df_after, log = transformer.transform(df_after, rec.parameters)
                        all_changelog.append(log)
        else:
            # Default pipeline execution
            df_after, all_changelog = self.clean_dataframe(df_before)

        # Validate transformation
        validate_transformed_data(df_before, df_after)

        new_version = current_version + 1
        new_version_path = parquet_store.get_version_parquet_path(dataset_id, version=new_version)
        df_after.to_parquet(new_version_path, engine="pyarrow", index=False)

        # Write legacy clean alias (e.g. data_lake/ecommerce_sales_clean.parquet)
        clean_dataset_id = f"{dataset_id}_clean"
        legacy_clean_path = parquet_store.get_legacy_parquet_path(clean_dataset_id)
        df_after.to_parquet(legacy_clean_path, engine="pyarrow", index=False)

        # Reprofile and score the new version
        profile_after = dataset_profiler.profile_parquet(new_version_path)
        audit_after = quality_scoring_engine.evaluate_quality(profile_after, dataset_id, version=new_version)

        # Save new version in metadata repository
        metadata_repo.create_version(
            dataset_id=dataset_id,
            version=new_version,
            parent_version=current_version,
            storage_path=str(new_version_path),
            row_count=len(df_after),
            col_count=len(df_after.columns),
            size_bytes=new_version_path.stat().st_size,
            schema={"columns": list(df_after.columns), "dtypes": {c: str(t) for c, t in df_after.dtypes.items()}},
            profiling=profile_after,
            quality_score=audit_after.data_health_score,
            quality_report=audit_after.model_dump(),
            changelog=all_changelog
        )

        # Also register the clean alias as a dataset for legacy catalog cards
        metadata_repo.create_dataset(
            dataset_id=clean_dataset_id,
            name=f"{dataset_id.replace('_', ' ').title()} (Cleaned)",
            original_filename=f"{clean_dataset_id}.parquet",
            source_format="parquet",
            raw_storage_path=str(source_path),
            description=f"Cleaned version derived from {dataset_id}"
        )
        metadata_repo.create_version(
            dataset_id=clean_dataset_id,
            version=1,
            storage_path=str(legacy_clean_path),
            row_count=len(df_after),
            col_count=len(df_after.columns),
            size_bytes=legacy_clean_path.stat().st_size,
            schema={"columns": list(df_after.columns), "dtypes": {c: str(t) for c, t in df_after.dtypes.items()}},
            profiling=profile_after,
            quality_score=audit_after.data_health_score,
            quality_report=audit_after.model_dump(),
            changelog=all_changelog
        )

        removed_dups = max(0, profile_before.get("duplicate_rows", 0) - profile_after.get("duplicate_rows", 0))
        imputed_nulls = max(0, sum(c.get("null_count", 0) for c in profile_before.get("columns", [])) - sum(c.get("null_count", 0) for c in profile_after.get("columns", [])))

        return {
            "status": "success",
            "original_dataset_id": dataset_id,
            "cleaned_dataset_id": clean_dataset_id,
            "source_version": current_version,
            "new_version": new_version,
            "original_rows": original_rows,
            "cleaned_rows": len(df_after),
            "removed_duplicates": removed_dups,
            "imputed_nulls": imputed_nulls,
            "clean_parquet_file": str(new_version_path.name),
            "health_score_before": audit_before.data_health_score,
            "health_score_after": audit_after.data_health_score,
            "changelog": all_changelog,
            "total_rows_after": len(df_after),
            "parquet_path": str(new_version_path),
        }


cleaning_pipeline = DataCleaningPipeline()
