"""
Unit tests for Dataset Deletion API Endpoint (DELETE /datasets/{dataset_id}).
"""

import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.dataset_service import dataset_service
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store


class TestDatasetDeletion(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_delete_existing_dataset(self):
        # 1. Ingest sample dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, "delete_me_test.csv", "delete_me_target")
        d_id = ingest_res["dataset_id"]

        # Verify dataset exists in metadata
        self.assertIsNotNone(metadata_repo.get_dataset(d_id))
        self.assertTrue(Path(ingest_res["parquet_path"]).exists())

        # 2. Call DELETE endpoint
        resp = self.client.delete(f"/api/datasets/{d_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["dataset_id"], d_id)

        # 3. Verify metadata is gone
        self.assertIsNone(metadata_repo.get_dataset(d_id))
        self.assertEqual(len(metadata_repo.list_versions(d_id)), 0)

        # 4. Verify physical parquet is unlinked
        self.assertFalse(Path(ingest_res["parquet_path"]).exists())

    def test_delete_nonexistent_dataset_returns_404(self):
        resp = self.client.delete("/api/datasets/completely_nonexistent_id_99999")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
