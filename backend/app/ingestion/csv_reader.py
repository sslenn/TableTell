"""
CSV and file ingestion pipeline for TableTell.
Preserves immutable raw dataset and converts into analytical Parquet format.
"""

from pathlib import Path
from typing import Dict, Any, Tuple
import io
import pandas as pd
from app.ingestion.schema_inference import normalize_column_name
from app.storage.parquet_store import parquet_store
from app.core.exceptions import InvalidFileError


def read_tabular_file(file_content: bytes, filename: str) -> pd.DataFrame:
    """
    Safely reads file content with multi-encoding fallback and malformed line tolerance.
    """
    lower = filename.lower()
    
    if lower.endswith(".csv"):
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
        last_error = None
        for enc in encodings:
            try:
                # Try reading with pandas
                df = pd.read_csv(io.BytesIO(file_content), encoding=enc, on_bad_lines="skip")
                return df
            except Exception as e:
                last_error = e
                continue
        raise InvalidFileError(f"Failed to parse CSV with supported encodings: {last_error}")

    elif lower.endswith((".xlsx", ".xls")):
        try:
            return pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise InvalidFileError(f"Failed to parse Excel file: {e}")

    elif lower.endswith(".parquet"):
        try:
            return pd.read_parquet(io.BytesIO(file_content))
        except Exception as e:
            raise InvalidFileError(f"Failed to parse Parquet file: {e}")

    else:
        raise InvalidFileError(f"Unsupported file format for: '{filename}'")


def ingest_file_to_storage(
    file_content: bytes,
    filename: str,
    dataset_id: str,
) -> Tuple[Path, Path, pd.DataFrame]:
    """
    1. Preserves raw file immutably in data_lake/raw/
    2. Standardizes column headers to snake_case
    3. Writes version 1 Parquet file in data_lake/processed/
    4. Also writes legacy alias in data_lake/ for backward compatibility
    Returns: (raw_path, parquet_path, df)
    """
    ext = Path(filename).suffix.lstrip(".") or "csv"
    raw_path = parquet_store.get_raw_path(dataset_id, extension=ext)
    
    # Save raw file content immutably
    with open(raw_path, "wb") as f:
        f.write(file_content)

    # Parse dataframe safely
    df = read_tabular_file(file_content, filename)

    # Standardize column headers
    df.columns = [normalize_column_name(c) for c in df.columns]

    # Save initial Version 1 Parquet
    v1_parquet_path = parquet_store.get_version_parquet_path(dataset_id, version=1)
    df.to_parquet(v1_parquet_path, engine="pyarrow", index=False)

    # Save legacy alias in base data_lake for full backward compatibility
    legacy_path = parquet_store.get_legacy_parquet_path(dataset_id)
    df.to_parquet(legacy_path, engine="pyarrow", index=False)

    return raw_path, v1_parquet_path, df
