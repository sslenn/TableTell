"""
Performance benchmark script for TableTell core workflows:
1. CSV Ingestion
2. Dataset Profiling & Multi-dimensional Quality Scoring
3. Cleaning Execution & Versioning
4. DuckDB Analytical Query Execution
5. Plotly Visualization Synthesis
"""

import time
import io
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service
from app.services.cleaning_service import cleaning_pipeline
from app.analytics.executor import query_executor
from app.analytics.visualization import build_plotly_spec


def run_benchmarks():
    print("=" * 60)
    print("TABLETELL PERFORMANCE BENCHMARKS")
    print("=" * 60)

    # Generate a realistic 10,000-row business dataset
    n_rows = 10000
    rng = np.random.default_rng(42)
    categories = ["Electronics", "Fashion", "Home & Living", "Health", "Books"]
    cat_choices = rng.choice(categories, size=n_rows)
    df_raw = pd.DataFrame({
        "order_id": [f"ORD-{i:06d}" for i in range(1, n_rows + 1)],
        "order_date": rng.choice(pd.date_range("2026-01-01", "2026-06-30", freq="h"), size=n_rows),
        "customer_id": [f"CUST-{i:05d}" for i in rng.integers(1000, 2500, size=n_rows)],
        "category": cat_choices,
        "quantity": rng.choice([1, 2, 3, 4, 5, -1], size=n_rows, p=[0.3, 0.3, 0.2, 0.1, 0.08, 0.02]),
        "unit_price": rng.uniform(10.0, 500.0, size=n_rows).round(2),
        "revenue": rng.uniform(10.0, 2500.0, size=n_rows).round(2)
    })
    # Inject 100 duplicate rows
    dups = df_raw.iloc[:100].copy()
    df_raw = pd.concat([df_raw, dups], ignore_index=True)
    csv_bytes = df_raw.to_csv(index=False).encode("utf-8")
    file_size_kb = len(csv_bytes) / 1024.0

    print(f"Benchmark Dataset: {len(df_raw):,} rows, {len(df_raw.columns)} cols ({file_size_kb:.1f} KB)")
    print("-" * 60)

    # 1. Ingestion Benchmark
    t0 = time.perf_counter()
    upload_res = dataset_service.upload_dataset(csv_bytes, "benchmark_sales.csv", "bench_sales")
    ingest_ms = (time.perf_counter() - t0) * 1000
    dataset_id = upload_res["dataset_id"]
    print(f"1. CSV Ingestion & Parquet Conversion : {ingest_ms:.2f} ms")

    # 2. Profiling & Quality Scoring Benchmark
    t0 = time.perf_counter()
    audit = quality_service.get_dataset_audit(dataset_id, version=1, force_recompute=True)
    profile_ms = (time.perf_counter() - t0) * 1000
    print(f"2. Vectorized Profiling & Quality Audit: {profile_ms:.2f} ms (Score: {audit.data_health_score}/100)")

    # 3. Cleaning & Versioning Benchmark
    t0 = time.perf_counter()
    clean_res = cleaning_pipeline.clean_dataset(dataset_id, description="Benchmark clean")
    clean_ms = (time.perf_counter() - t0) * 1000
    print(f"3. Cleaning Pipeline & Version 2 Write : {clean_ms:.2f} ms (Rows: {clean_res['original_rows']:,} -> {clean_res['cleaned_rows']:,})")

    # 4. DuckDB Aggregation Query Benchmark
    sql = f'SELECT "category", COUNT(*) AS orders, ROUND(SUM("revenue"), 2) AS total_revenue FROM "{dataset_id}" GROUP BY "category" ORDER BY total_revenue DESC'
    t0 = time.perf_counter()
    query_res = query_executor.execute_query(dataset_id, sql, version=2)
    query_ms = (time.perf_counter() - t0) * 1000
    print(f"4. DuckDB Group-By Aggregation SQL    : {query_ms:.2f} ms (Engine execution: {query_res['duration_ms']:.2f} ms)")

    # 5. Plotly Spec Synthesis Benchmark
    t0 = time.perf_counter()
    chart_spec = build_plotly_spec(query_res["rows"], query_res["columns"], "Revenue by category")
    viz_ms = (time.perf_counter() - t0) * 1000
    print(f"5. Plotly Spec Chart Synthesis         : {viz_ms:.2f} ms (Chart type: {chart_spec['data'][0]['type']})")

    print("-" * 60)
    total_ms = ingest_ms + profile_ms + clean_ms + query_ms + viz_ms
    print(f"Total End-to-End Pipeline Latency      : {total_ms:.2f} ms")
    print("=" * 60)


if __name__ == "__main__":
    run_benchmarks()
