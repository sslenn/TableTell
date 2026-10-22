"""
Deterministic sample dataset fixtures for TableTell automated testing.
Contains known, measurable defects:
- Missing customer IDs and transaction IDs (critical nulls)
- Exact duplicate rows
- Negative quantities
- Mixed date formats (%m.%d.%y and %m/%d/%Y)
- Numeric outliers
"""

import io
import pandas as pd


def create_sample_dirty_csv_bytes() -> bytes:
    """
    Creates a dirty CSV with 10 rows:
    - Row 0-1: Exact duplicates
    - Row 2: Missing CustomerNo (critical ID null)
    - Row 3: Negative quantity (-5)
    - Row 4: Non-standard dot date format (05.12.24)
    - Row 5: High numeric price outlier (9999.0)
    """
    csv_text = """CustomerNo,Date,TransactionNo,ProductNo,ProductName,Quantity,Price,Country
1001,2026-01-10,TX1001,P01,Widget Alpha,2,25.50,United States
1001,2026-01-10,TX1001,P01,Widget Alpha,2,25.50,United States
,2026-01-11,TX1002,P02,Widget Beta,1,45.00,United Kingdom
1002,2026-01-12,TX1003,P03,Widget Gamma,-5,15.00,Germany
1003,05.12.24,TX1004,P04,Widget Delta,3,30.00,France
1004,2026-01-13,TX1005,P05,Widget Premium,1,9999.00,Japan
1005,2026-01-14,TX1006,P01,Widget Alpha,4,25.50,Singapore
1006,2026-01-15,TX1007,P02,Widget Beta,2,45.00,Australia
1007,2026-01-16,TX1008,P03,Widget Gamma,1,15.00,Canada
1008,2026-01-17,TX1009,P04,Widget Delta,5,30.00,United States
"""
    return csv_text.encode("utf-8")


def create_clean_baseline_df() -> pd.DataFrame:
    """Returns a completely clean DataFrame for baseline comparisons."""
    return pd.DataFrame({
        "order_id": [f"ORD-{i:04d}" for i in range(1, 21)],
        "order_date": pd.date_range("2026-01-01", periods=20, freq="D"),
        "customer_id": [f"CUST-{i:03d}" for i in range(1, 21)],
        "category": ["Electronics", "Books", "Fashion", "Home"] * 5,
        "quantity": [1, 2, 3, 4] * 5,
        "price": [10.0, 25.5, 50.0, 100.0] * 5,
        "revenue": [10.0, 51.0, 150.0, 400.0] * 5
    })
