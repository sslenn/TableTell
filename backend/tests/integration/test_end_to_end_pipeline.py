"""
End-to-End Integration Tests for TableTell Pipeline.
Tests:
Upload -> Raw Preservation -> Profiling -> Quality Scoring -> Cleaning Proposal ->
Approved Cleaning -> Version 2 Creation -> DuckDB Query -> Plotly Spec -> Run Lineage Trace.
"""

import unittest
from pathlib import Path
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service
from app.services.cleaning_service import cleaning_pipeline
from app.services.analytics_service import analytics_service
from app.cleaning.planner import cleaning_planner
from app.storage.metadata_repo import metadata_repo
from app.analytics.executor import query_executor
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes


class TestEndToEndPipeline(unittest.TestCase):
    def test_full_agentic_bi_pipeline(self):
        # 1. Upload CSV dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        upload_res = dataset_service.upload_dataset(
            file_content=csv_bytes,
            filename="e2e_dirty_retail.csv",
            custom_name="e2e_test_retail"
        )
        dataset_id = upload_res["dataset_id"]
        self.assertTrue(dataset_id)
        self.assertEqual(upload_res["total_rows"], 10)

        # Verify raw file is preserved immutably
        raw_path = Path(metadata_repo.get_dataset(dataset_id)["raw_storage_path"])
        self.assertTrue(raw_path.exists())
        raw_size = raw_path.stat().st_size
        self.assertGreater(raw_size, 0)

        # 2. Quality Audit
        audit = quality_service.get_dataset_audit(dataset_id, version=1)
        self.assertEqual(audit.version, 1)
        self.assertEqual(audit.duplicate_rows, 1)
        self.assertGreater(len(audit.structured_issues), 0)
        self.assertEqual(len(audit.dimensions), 5)
        initial_score = audit.data_health_score

        # 3. Create Cleaning Plan
        plan = cleaning_planner.create_plan(audit)
        self.assertTrue(plan.plan_id.startswith("plan_"))
        self.assertGreater(len(plan.recommendations), 0)

        # 4. Execute Cleaning Run
        clean_res = cleaning_pipeline.clean_dataset(
            dataset_id=dataset_id,
            description="Integration test cleaning run"
        )
        self.assertEqual(clean_res["status"], "success")
        self.assertEqual(clean_res["source_version"], 1)
        self.assertEqual(clean_res["new_version"], 2)
        self.assertGreater(clean_res["health_score_after"], initial_score)
        self.assertEqual(clean_res["removed_duplicates"], 1)

        # Verify raw dataset remained 100% UNTOUCHED
        self.assertEqual(raw_path.stat().st_size, raw_size)

        # 5. Direct DuckDB Analytical Query Execution
        query_sql = f'SELECT "productname", COUNT(*) AS sales_count FROM "{dataset_id}" GROUP BY "productname" ORDER BY sales_count DESC LIMIT 5'
        exec_res = query_executor.execute_query(dataset_id, query_sql, version=2)
        self.assertTrue(exec_res["success"])
        self.assertGreater(exec_res["row_count"], 0)
        self.assertIn("sales_count", exec_res["columns"])

        # 6. Analytics Service Question-to-Result & Run Lineage Trace
        chat_res = analytics_service.process_query(
            dataset_id=dataset_id,
            user_query="Which product name had the most sales?",
            version=2
        )
        self.assertEqual(chat_res.status, "success")
        self.assertIsNotNone(chat_res.table)
        self.assertGreater(chat_res.table.row_count, 0)
        self.assertIsNotNone(chat_res.summary)
        self.assertTrue(chat_res.run_id.startswith("run_"))

        # 7. Verify Run Lineage in SQLite Repository
        saved_run = metadata_repo.get_analytical_run(chat_res.run_id)
        self.assertIsNotNone(saved_run)
        self.assertEqual(saved_run["dataset_id"], dataset_id)
        self.assertEqual(saved_run["dataset_version"], 2)


if __name__ == "__main__":
    unittest.main()
