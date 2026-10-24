"""
Unit tests for Dataset Rename API Endpoint (POST/PATCH /datasets/{dataset_id}/rename).
"""

import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.dataset_service import dataset_service
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store
from app.analytics.executor import query_executor


class TestDatasetRename(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_rename_existing_dataset(self):
        import uuid
        uid = uuid.uuid4().hex[:6]
        target_name = f"renamed_target_{uid}"
        # 1. Ingest sample dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, f"rename_src_{uid}.csv")
        old_id = ingest_res["dataset_id"]

        self.assertIsNotNone(metadata_repo.get_dataset(old_id))

        # 2. Call rename endpoint
        resp = self.client.post(
            f"/api/datasets/{old_id}/rename",
            json={"new_name": target_name}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["old_dataset_id"], old_id)
        self.assertEqual(data["new_dataset_id"], target_name)

        # 3. Verify old metadata is gone, new exists
        self.assertIsNone(metadata_repo.get_dataset(old_id))
        new_meta = metadata_repo.get_dataset(target_name)
        self.assertIsNotNone(new_meta)
        self.assertEqual(new_meta["id"], target_name)

        # 4. Verify parquet store can resolve the new path and execute query
        resolved_path = parquet_store.resolve_dataset_path(target_name)
        self.assertTrue(resolved_path.exists())

        # Verify DuckDB can query the renamed dataset
        query_res = query_executor.execute_query(target_name, f'SELECT * FROM "{target_name}" LIMIT 5')
        self.assertTrue(query_res["success"])
        self.assertGreater(len(query_res["rows"]), 0)

        # Clean up
        dataset_service.delete_dataset(target_name)

    def test_rename_nonexistent_dataset_returns_404(self):
        resp = self.client.post(
            "/api/datasets/completely_nonexistent_99999/rename",
            json={"new_name": "whatever"}
        )
        self.assertEqual(resp.status_code, 404)

    def test_rename_invalid_empty_name_returns_400(self):
        # Create a test dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, "invalid_test.csv")
        d_id = ingest_res["dataset_id"]

        try:
            resp = self.client.post(
                f"/api/datasets/{d_id}/rename",
                json={"new_name": "   "}
            )
            # validation error or bad request
            self.assertIn(resp.status_code, (400, 422))
        finally:
            dataset_service.delete_dataset(d_id)


if __name__ == "__main__":
    unittest.main()
