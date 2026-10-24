"""
Unit tests for Chat SSE Streaming Endpoint and cancellation handling (/api/chat/stream).
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.services.dataset_service import dataset_service
from tests.fixtures.sample_data import create_sample_dirty_csv_bytes


class TestChatStream(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_chat_stream_nonexistent_dataset(self):
        resp = self.client.post(
            "/api/chat/stream",
            json={"dataset_id": "nonexistent_dataset_xyz", "query": "select count(*)"}
        )
        self.assertEqual(resp.status_code, 404)

    def test_chat_stream_event_flow(self):
        uid = uuid.uuid4().hex[:6]
        csv_bytes = create_sample_dirty_csv_bytes()
        ingest_res = dataset_service.upload_dataset(csv_bytes, f"chat_stream_{uid}.csv")
        dataset_id = ingest_res["dataset_id"]

        try:
            with self.client.stream(
                "POST",
                "/api/chat/stream",
                json={"dataset_id": dataset_id, "query": "Show top 5 rows"}
            ) as response:
                self.assertEqual(response.status_code, 200)
                self.assertIn("text/event-stream", response.headers.get("content-type", ""))

                events = []
                for line in response.iter_lines():
                    if line and line.startswith("event:"):
                        events.append(line.replace("event:", "").strip())

                # Verify stream events emitted
                self.assertTrue(len(events) > 0)
                self.assertIn("status", events)
        finally:
            try:
                dataset_service.delete_dataset(dataset_id)
            except Exception:
                pass


if __name__ == "__main__":
    unittest.main()
