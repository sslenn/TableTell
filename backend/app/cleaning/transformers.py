"""
Modular, testable data transformation steps for TableTell.
"""

from abc import ABC, abstractmethod
from typing import Tuple, List, Dict, Any, Optional
import re
import pandas as pd
import numpy as np


class BaseTransformer(ABC):
    """Abstract base class for all data transformations."""
    
    @abstractmethod
    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        """
        Executes a transformation on a DataFrame.
        Returns: (transformed_df, changelog_message)
        """
        pass


class DropDuplicatesTransformer(BaseTransformer):
    """Removes exact duplicate rows or primary key collisions."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        initial_len = len(df)
        params = params or {}
        subset = params.get("subset")
        
        if subset:
            existing = [c for c in subset if c in df.columns]
            if existing:
                df = df.drop_duplicates(subset=existing, keep="first")
            else:
                df = df.drop_duplicates(keep="first")
        else:
            df = df.drop_duplicates(keep="first")

        dropped = initial_len - len(df)
        msg = f"Removed {dropped:,} duplicate records." if dropped > 0 else "No duplicate rows found."
        return df, msg


class DropMissingIdentifiersTransformer(BaseTransformer):
    """Drops rows missing critical identifier keys."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        initial_len = len(df)
        params = params or {}
        subset = params.get("subset", [])
        
        cols_lookup = {c.lower(): c for c in df.columns}
        matched = [cols_lookup[c.lower()] for c in subset if c.lower() in cols_lookup]

        if not matched:
            # Fallback to standard identifier names
            for default_k in ["transactionno", "customerno", "order_id", "account_id"]:
                if default_k in cols_lookup:
                    matched.append(cols_lookup[default_k])

        if matched:
            df = df.dropna(subset=matched)

        # Standardize customer id float artifacts like '12345.0' -> '12345'
        for col in matched:
            if "customer" in col.lower() or "id" in col.lower():
                def _clean_id(v):
                    if pd.isna(v):
                        return ""
                    s = str(v).strip()
                    if s.endswith(".0"):
                        s = s[:-2]
                    return s
                df[col] = df[col].apply(_clean_id)

        dropped = initial_len - len(df)
        msg = f"Dropped {dropped:,} rows with missing critical identifiers ({', '.join(matched)})." if dropped > 0 else "No missing identifier records to drop."
        return df, msg


class StandardizeDatesTransformer(BaseTransformer):
    """Parses mixed date strings into unified ISO datetime."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        params = params or {}
        target_col = params.get("date_col")

        if not target_col or target_col not in df.columns:
            for c in df.columns:
                if any(k in c.lower() for k in ["date", "timestamp", "time"]):
                    target_col = c
                    break

        if target_col and target_col in df.columns:
            if not pd.api.types.is_datetime64_any_dtype(df[target_col]):
                fmt1 = pd.to_datetime(df[target_col], format="%m.%d.%y", errors="coerce")
                fmt2 = pd.to_datetime(df[target_col], format="%m/%d/%Y", errors="coerce")
                fmt3 = pd.to_datetime(df[target_col], errors="coerce", format="mixed")
                df[target_col] = fmt1.fillna(fmt2).fillna(fmt3)
                return df, f"Standardized date formatting in column '{target_col}'."

        return df, "No date columns required standardization."


class CleanQuantitiesTransformer(BaseTransformer):
    """Sanitizes negative quantities, commas, and casts to float."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        params = params or {}
        target_col = params.get("qty_col")

        if not target_col or target_col not in df.columns:
            for c in df.columns:
                if any(k in c.lower() for k in ["quantity", "qty"]):
                    target_col = c
                    break

        if target_col and target_col in df.columns:
            cleaned = (
                df[target_col]
                .astype(str)
                .str.replace("-", "", regex=False)
                .str.replace(",", "", regex=False)
                .str.strip()
            )
            df[target_col] = pd.to_numeric(cleaned, errors="coerce").fillna(0.0)
            return df, f"Sanitized negative signs and non-numeric characters in '{target_col}'."

        return df, "No quantity columns required sanitization."


class ImputeMissingValuesTransformer(BaseTransformer):
    """Imputes remaining non-critical missing values."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        imputed_counts = 0

        for col in df.columns:
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                if pd.api.types.is_numeric_dtype(df[col]):
                    med = float(df[col].median())
                    df[col] = df[col].fillna(med)
                    imputed_counts += null_count
                else:
                    df[col] = df[col].fillna("Unknown")
                    imputed_counts += null_count

        msg = f"Imputed {imputed_counts:,} non-critical missing values with median/Unknown." if imputed_counts > 0 else "No missing values required imputation."
        return df, msg


class NormalizeHeadersTransformer(BaseTransformer):
    """Standardizes column headers to snake_case."""

    def transform(self, df: pd.DataFrame, params: Optional[Dict[str, Any]] = None) -> Tuple[pd.DataFrame, str]:
        df = df.copy()
        old_cols = list(df.columns)
        new_cols = []
        for c in old_cols:
            cleaned = str(c).strip().lower()
            cleaned = re.sub(r"[^\w\s]", "", cleaned)
            cleaned = re.sub(r"\s+", "_", cleaned)
            new_cols.append(cleaned or "column")
        df.columns = new_cols
        return df, "Normalized column headers to snake_case."


TRANSFORMER_REGISTRY: Dict[str, BaseTransformer] = {
    "drop_duplicates": DropDuplicatesTransformer(),
    "drop_critical_nulls": DropMissingIdentifiersTransformer(),
    "standardize_dates": StandardizeDatesTransformer(),
    "clean_quantities": CleanQuantitiesTransformer(),
    "impute_numeric": ImputeMissingValuesTransformer(),
    "impute_categorical": ImputeMissingValuesTransformer(),
    "normalize_headers": NormalizeHeadersTransformer(),
}
