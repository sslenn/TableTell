"""
Unit tests for Dataset Export API Endpoint (/datasets/{dataset_id}/export).
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.services.dataset_service import dataset_service
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes
from app.services.cleaning_service import cleaning_pipeline


class TestDatasetExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Ingest and clean a dataset
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, "export_test_raw.csv", "export_test_dataset")
        cls.raw_id = ingest_res["dataset_id"]
        clean_res = cleaning_pipeline.clean_dataset(cls.raw_id)
        cls.clean_id = clean_res["cleaned_dataset_id"]

    def test_export_clean_dataset_default_csv(self):
        resp = self.client.get(f"/api/datasets/{self.clean_id}/export")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp.headers["content-type"])
        self.assertIn(f"{self.clean_id}.csv", resp.headers["content-disposition"])
        # Should start with UTF-8 BOM
        self.assertTrue(resp.content.startswith(b"\xef\xbb\xbf"))
        text = resp.content.decode("utf-8-sig")
        lines = text.strip().split("\n")
        self.assertGreater(len(lines), 1)

    def test_export_csv_without_bom_and_custom_delimiter(self):
        resp = self.client.get(f"/api/datasets/{self.clean_id}/export?delimiter=;&bom=false")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.content.startswith(b"\xef\xbb\xbf"))
        text = resp.content.decode("utf-8")
        self.assertIn(";", text.split("\n")[0])

    def test_export_clean_dataset_tsv(self):
        resp = self.client.get(f"/api/datasets/{self.clean_id}/export?format=tsv")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/tab-separated-values", resp.headers["content-type"])
        self.assertIn(f"{self.clean_id}.tsv", resp.headers["content-disposition"])

    def test_export_clean_dataset_json(self):
        resp = self.client.get(f"/api/datasets/{self.clean_id}/export?format=json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("application/json", resp.headers["content-type"])
        data = resp.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_export_nonexistent_dataset_404(self):
        resp = self.client.get("/api/datasets/non_existent_dataset_12345/export")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
