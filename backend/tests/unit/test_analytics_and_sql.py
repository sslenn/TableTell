"""
Unit tests for SQL validation, query generation, and Plotly visualization synthesis.
"""

import unittest
from app.analytics.sql_validator import validate_read_only_sql
from app.analytics.sql_generator import simulate_sql_fallback
from app.analytics.visualization import build_plotly_spec
from app.core.exceptions import UnsafeSQLError


class TestAnalyticsAndSQL(unittest.TestCase):
    def test_sql_validator_allows_select(self):
        valid1 = "SELECT * FROM ecommerce_sales LIMIT 10"
        self.assertEqual(validate_read_only_sql(valid1), valid1)

        valid2 = "WITH cat_summary AS (SELECT category, SUM(revenue) as rev FROM df GROUP BY category) SELECT * FROM cat_summary ORDER BY rev DESC;"
        self.assertTrue(validate_read_only_sql(valid2).startswith("WITH"))

    def test_sql_validator_rejects_ddl_and_dml(self):
        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("DROP TABLE ecommerce_sales;")

        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("DELETE FROM df WHERE quantity < 0;")

        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("INSERT INTO df VALUES (1, 2, 3);")

        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("ATTACH 'database.db' AS db;")

        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("COPY df TO 'out.csv';")

    def test_sql_validator_rejects_chained_queries(self):
        with self.assertRaises(UnsafeSQLError):
            validate_read_only_sql("SELECT * FROM df; DROP TABLE df;")

    def test_simulate_sql_fallback(self):
        col_names = ["order_id", "order_date", "product_category", "revenue_usd", "quantity"]
        dtypes = {
            "order_id": "VARCHAR",
            "order_date": "DATE",
            "product_category": "VARCHAR",
            "revenue_usd": "DOUBLE",
            "quantity": "BIGINT"
        }

        # Category question
        sql_cat = simulate_sql_fallback("Which category generates the most revenue?", "ecommerce_sales", col_names, dtypes)
        self.assertIn("product_category", sql_cat)
        self.assertIn("revenue_usd", sql_cat)
        self.assertIn("GROUP BY", sql_cat)

        # Trend question
        sql_trend = simulate_sql_fallback("Show monthly revenue trend over time", "ecommerce_sales", col_names, dtypes)
        self.assertIn("order_date", sql_trend)
        self.assertIn("ORDER BY", sql_trend)

    def test_build_plotly_spec_bar_chart(self):
        rows = [
            {"product_category": "Electronics", "total_revenue": 15000.0},
            {"product_category": "Fashion", "total_revenue": 9500.0}
        ]
        columns = ["product_category", "total_revenue"]
        spec = build_plotly_spec(rows, columns, "Revenue by category")
        self.assertIsNotNone(spec)
        self.assertEqual(spec["data"][0]["type"], "bar")
        self.assertEqual(spec["layout"]["template"], "plotly_dark")

    def test_build_plotly_spec_line_chart_for_dates(self):
        rows = [
            {"order_date": "2026-01-01", "total_revenue": 1200.0},
            {"order_date": "2026-01-02", "total_revenue": 1450.0}
        ]
        columns = ["order_date", "total_revenue"]
        spec = build_plotly_spec(rows, columns, "Daily revenue trend")
        self.assertIsNotNone(spec)
        self.assertEqual(spec["data"][0]["type"], "scatter")
        self.assertIn("lines", spec["data"][0]["mode"])

    def test_build_plotly_spec_kpi(self):
        rows = [{"total_revenue": 54200.0}]
        columns = ["total_revenue"]
        spec = build_plotly_spec(rows, columns, "What is the total revenue?")
        self.assertIsNotNone(spec)
        self.assertEqual(spec["data"][0]["type"], "indicator")


if __name__ == "__main__":
    unittest.main()
