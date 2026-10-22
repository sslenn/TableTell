"""
Unit tests for ingestion and schema inference modules.
"""

import unittest
from pathlib import Path
from app.ingestion.schema_inference import normalize_column_name
from app.ingestion.validation import validate_upload_file
from app.ingestion.csv_reader import read_tabular_file, ingest_file_to_storage
from app.core.exceptions import InvalidFileError, FileTooLargeError
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes


class TestIngestionAndSchema(unittest.TestCase):
    def test_normalize_column_name(self):
        self.assertEqual(normalize_column_name("Customer No"), "customer_no")
        self.assertEqual(normalize_column_name("Total Revenue ($USD)"), "total_revenue_usd")
        self.assertEqual(normalize_column_name("   PRODUCT_ID   "), "product_id")
        self.assertEqual(normalize_column_name("Date/Time"), "datetime")

    def test_file_validation_valid(self):
        # Should not raise exception
        validate_upload_file("sales_data.csv", 1024)
        validate_upload_file("inventory.parquet", 2048)
        validate_upload_file("report.xlsx", 5000)

    def test_file_validation_invalid_extension(self):
        with self.assertRaises(InvalidFileError):
            validate_upload_file("malicious.exe", 1024)
        with self.assertRaises(InvalidFileError):
            validate_upload_file("notes.txt", 1024)

    def test_file_validation_too_large(self):
        too_large_bytes = 101 * 1024 * 1024  # 101 MB exceeds 100MB limit
        with self.assertRaises(FileTooLargeError):
            validate_upload_file("massive.csv", too_large_bytes)

    def test_read_tabular_file_csv(self):
        csv_bytes = create_sample_dirty_csv_bytes()
        df = read_tabular_file(csv_bytes, "dirty.csv")
        self.assertEqual(len(df), 10)
        self.assertIn("CustomerNo", df.columns)

    def test_ingest_preserves_raw_and_creates_parquet(self):
        csv_bytes = create_sample_dirty_csv_bytes()
        test_id = "test_unit_ingest"
        raw_path, v1_parquet, df = ingest_file_to_storage(csv_bytes, "test.csv", test_id)

        self.assertTrue(raw_path.exists())
        self.assertTrue(v1_parquet.exists())
        self.assertEqual(raw_path.suffix, ".csv")
        self.assertEqual(v1_parquet.suffix, ".parquet")
        # Column names in parquet should be normalized to snake_case
        self.assertIn("customerno", df.columns)
        self.assertIn("transactionno", df.columns)


if __name__ == "__main__":
    unittest.main()
