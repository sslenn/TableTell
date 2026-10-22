"""
Unit tests for profiling, column statistics, deterministic rules, and quality scoring.
"""

import unittest
import pandas as pd
from pathlib import Path
from app.profiling.column_stats import classify_column_semantic_type, compute_numeric_stats
from app.profiling.profiler import dataset_profiler
from app.quality.scoring import quality_scoring_engine
from app.quality.recommendations import generate_recommendations
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes, create_clean_baseline_df
from app.ingestion.csv_reader import ingest_file_to_storage


class TestProfilingAndQuality(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create test dirty parquet
        csv_bytes = create_sample_dirty_csv_bytes()
        cls.test_id = "test_unit_quality"
        cls.raw_path, cls.parquet_path, _ = ingest_file_to_storage(csv_bytes, "dirty.csv", cls.test_id)

    def test_classify_column_semantic_type(self):
        self.assertEqual(classify_column_semantic_type("order_id", "VARCHAR", 100, 100), "identifier")
        self.assertEqual(classify_column_semantic_type("order_date", "DATE", 50, 100), "datetime")
        self.assertEqual(classify_column_semantic_type("unit_price", "DOUBLE", 40, 100), "numeric")
        self.assertEqual(classify_column_semantic_type("is_active", "BOOLEAN", 2, 100), "boolean")
        self.assertEqual(classify_column_semantic_type("country", "VARCHAR", 5, 100), "categorical")

    def test_compute_numeric_stats_outliers(self):
        # Series with normal values 10, 11, 12, 10, 11 and an extreme outlier 999
        s = pd.Series([10, 11, 12, 10, 11, 10, 12, 11, 999])
        stats = compute_numeric_stats(s)
        self.assertEqual(stats["min"], 10.0)
        self.assertEqual(stats["max"], 999.0)
        self.assertGreater(stats["outlier_count"], 0)

    def test_profiler_detects_duplicates_and_nulls(self):
        profile = dataset_profiler.profile_parquet(self.parquet_path)
        self.assertEqual(profile["total_rows"], 10)
        # Duplicate row check should detect 1 duplicate
        self.assertEqual(profile["duplicate_rows"], 1)
        # CustomerNo has 1 null
        cust_col = next(c for c in profile["columns"] if "customer" in c["column_name"])
        self.assertEqual(cust_col["null_count"], 1)

    def test_quality_scoring_engine_dimensions(self):
        profile = dataset_profiler.profile_parquet(self.parquet_path)
        audit = quality_scoring_engine.evaluate_quality(profile, self.test_id, version=1)

        # Health score must be between 10 and 100
        self.assertGreaterEqual(audit.data_health_score, 10)
        self.assertLessEqual(audit.data_health_score, 100)
        # Dimensions must contain all 5 standard dimensions
        dim_names = [d.dimension for d in audit.dimensions]
        self.assertIn("Completeness", dim_names)
        self.assertIn("Validity", dim_names)
        self.assertIn("Consistency", dim_names)
        self.assertIn("Uniqueness", dim_names)
        self.assertIn("Anomaly Review", dim_names)

        # Dirty dataset has duplicates & nulls, so uniqueness and completeness should fail checks
        uniq_dim = next(d for d in audit.dimensions if d.dimension == "Uniqueness")
        self.assertGreater(uniq_dim.checks_failed, 0)

    def test_recommendation_generation(self):
        profile = dataset_profiler.profile_parquet(self.parquet_path)
        audit = quality_scoring_engine.evaluate_quality(profile, self.test_id, version=1)
        recs = generate_recommendations(audit)

        action_types = [r.action_type for r in recs]
        self.assertIn("drop_duplicates", action_types)
        self.assertTrue(len(recs) > 0)


if __name__ == "__main__":
    unittest.main()
