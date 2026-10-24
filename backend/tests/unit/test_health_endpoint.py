"""
Unit test for System Health Endpoint (/api/health).
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app


class TestHealthEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint_structure(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("status", data)
        self.assertIn("diagnostics", data)
        diag = data["diagnostics"]

        # Check subcomponents
        self.assertIn("metadata_db", diag)
        self.assertIn("duckdb_engine", diag)
        self.assertIn("storage", diag)
        self.assertIn("ai_engine", diag)

        self.assertEqual(diag["duckdb_engine"]["status"], "ready")
        self.assertEqual(diag["metadata_db"]["status"], "connected")
        self.assertIn("data_lake_size_mb", diag["storage"])


if __name__ == "__main__":
    unittest.main()
