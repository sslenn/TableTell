"""
Unit tests for Option A Senior Data Analyst Features:
1. Executive Insights Engine (Structured C-Suite Briefings)
2. Diagnostic Analytics & Driver Decomposition (Pareto 80/20)
3. Vectorized Pearson Correlation Matrix & Multicollinearity
"""

import unittest
from pathlib import Path
import pandas as pd
import duckdb
from app.analytics.insights_engine import synthesize_executive_briefing
from app.analytics.driver_analyzer import DriverAnalyzer
from app.profiling.correlation import CorrelationAnalyzer
from app.storage.parquet_store import parquet_store


class TestDiagnosticAnalytics(unittest.TestCase):
    def setUp(self):
        # Create a sample business dataset
        self.df = pd.DataFrame({
            "category": ["Electronics", "Clothing", "Home & Garden", "Books", "Toys"],
            "revenue": [50000.0, 30000.0, 12000.0, 5000.0, 3000.0],
            "marketing_spend": [10000.0, 6000.0, 2500.0, 1000.0, 600.0],
            "units_sold": [500, 1200, 300, 400, 250]
        })
        self.dataset_id = "test_sales_data"
        p_path = parquet_store.get_version_parquet_path(self.dataset_id, 1)
        self.df.to_parquet(p_path)

    def tearDown(self):
        parquet_store.delete_dataset_files(self.dataset_id)

    def test_executive_insights_engine(self):
        rows = self.df.to_dict(orient="records")
        columns = list(self.df.columns)
        memo = synthesize_executive_briefing(
            user_query="What is total revenue by category?",
            sql="SELECT category, revenue FROM test_sales_data",
            rows=rows,
            columns=["category", "revenue"],
            dataset_id=self.dataset_id
        )
        self.assertIn("Executive Takeaway", memo)
        self.assertIn("Key Drivers & Attribution", memo)
        self.assertIn("Strategic Recommendations", memo)
        self.assertIn("Electronics", memo)
        self.assertIn("50.0k", memo)  # 50,000 formatted

    def test_driver_decomposition(self):
        analyzer = DriverAnalyzer()
        res = analyzer.analyze_drivers(
            dataset_id=self.dataset_id,
            metric_col="revenue",
            dimension_col="category"
        )
        self.assertEqual(res["dataset_id"], self.dataset_id)
        self.assertEqual(res["metric_name"], "revenue")
        self.assertEqual(res["dimension_name"], "category")
        self.assertEqual(res["total_metric"], 100000.0)
        self.assertTrue(len(res["drivers"]) > 0)
        top_driver = res["drivers"][0]
        self.assertEqual(top_driver["dimension_value"], "Electronics")
        self.assertEqual(top_driver["pct_of_total"], 50.0)
        self.assertIn("Primary Growth Driver", res["insights"][0])
        self.assertIn("Pareto", res["insights"][1])
        self.assertIn("data", res["chart_spec"])

    def test_correlation_matrix(self):
        analyzer = CorrelationAnalyzer()
        res = analyzer.compute_correlation_matrix(dataset_id=self.dataset_id)
        self.assertEqual(res["dataset_id"], self.dataset_id)
        self.assertTrue("revenue" in res["columns"])
        self.assertTrue("marketing_spend" in res["columns"])
        self.assertEqual(len(res["matrix"]), len(res["columns"]))
        # revenue and marketing_spend are perfectly linear in test data (corr ~ 1.0)
        rev_idx = res["columns"].index("revenue")
        mkt_idx = res["columns"].index("marketing_spend")
        self.assertAlmostEqual(res["matrix"][rev_idx][mkt_idx], 1.0, places=1)
        self.assertTrue(len(res["significant_pairs"]) > 0)
        self.assertTrue(len(res["collinearity_warnings"]) > 0)


if __name__ == "__main__":
    unittest.main()
