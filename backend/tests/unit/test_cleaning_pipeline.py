"""
Unit tests for data cleaning transformers, validation, and version creation.
"""

import unittest
import pandas as pd
from app.cleaning.transformers import (
    DropDuplicatesTransformer,
    DropMissingIdentifiersTransformer,
    StandardizeDatesTransformer,
    CleanQuantitiesTransformer,
    ImputeMissingValuesTransformer,
    NormalizeHeadersTransformer,
)
from app.cleaning.validation import validate_transformed_data
from app.core.exceptions import CleaningPlanError
from app.services.cleaning_service import cleaning_pipeline
from app.services.dataset_service import dataset_service
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes


class TestCleaningPipeline(unittest.TestCase):
    def test_drop_duplicates_transformer(self):
        df = pd.DataFrame({"id": [1, 1, 2], "val": ["a", "a", "b"]})
        t = DropDuplicatesTransformer()
        res_df, msg = t.transform(df)
        self.assertEqual(len(res_df), 2)
        self.assertIn("Removed 1 duplicate", msg)

    def test_drop_missing_identifiers(self):
        df = pd.DataFrame({"transactionno": ["TX1", None, "TX3"], "val": [10, 20, 30]})
        t = DropMissingIdentifiersTransformer()
        res_df, msg = t.transform(df)
        self.assertEqual(len(res_df), 2)
        self.assertIn("Dropped 1 rows", msg)

    def test_standardize_dates(self):
        df = pd.DataFrame({"date": ["05.12.24", "2026-01-10"]})
        t = StandardizeDatesTransformer()
        res_df, msg = t.transform(df)
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(res_df["date"]))

    def test_clean_quantities(self):
        df = pd.DataFrame({"quantity": ["-5", "10", " 25 "]})
        t = CleanQuantitiesTransformer()
        res_df, msg = t.transform(df)
        self.assertEqual(list(res_df["quantity"]), [5.0, 10.0, 25.0])

    def test_validation_prevents_empty_dataframe(self):
        df_before = pd.DataFrame({"a": [1, 2, 3]})
        df_empty = pd.DataFrame()
        with self.assertRaises(CleaningPlanError):
            validate_transformed_data(df_before, df_empty)

    def test_clean_dataset_creates_new_version(self):
        # Ingest dirty dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, "dirty_for_cleaning.csv", "dirty_dataset_clean_test")
        d_id = ingest_res["dataset_id"]

        # Run clean pipeline
        clean_res = cleaning_pipeline.clean_dataset(d_id)
        self.assertEqual(clean_res["status"], "success")
        self.assertGreater(clean_res["health_score_after"], clean_res["health_score_before"])
        self.assertLess(clean_res["cleaned_rows"], clean_res["original_rows"])
        self.assertEqual(clean_res["new_version"], 2)


if __name__ == "__main__":
    unittest.main()
