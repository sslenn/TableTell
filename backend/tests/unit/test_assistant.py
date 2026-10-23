"""
Unit tests for TableTell Assistant Service and Metadata Repository operations.
"""

import unittest
from app.storage.metadata_repo import metadata_repo
from app.services.assistant_service import assistant_service


class TestAssistantService(unittest.TestCase):
    def setUp(self):
        self.conv = metadata_repo.get_or_create_default_conversation()
        self.conv_id = self.conv["id"]
        # Clear existing messages for clean test
        metadata_repo.clear_assistant_history(self.conv_id)

    def test_default_conversation_exists(self):
        self.assertTrue(self.conv_id)
        self.assertIn("TableTell", self.conv["title"])

    def test_save_and_list_assistant_messages(self):
        # Save user message
        msg1 = metadata_repo.save_assistant_message(
            conversation_id=self.conv_id,
            role="user",
            content="What is 1.5x IQR?"
        )
        self.assertTrue(msg1["id"].startswith("msg_"))
        self.assertEqual(msg1["content"], "What is 1.5x IQR?")

        # Save assistant message
        msg2 = metadata_repo.save_assistant_message(
            conversation_id=self.conv_id,
            role="assistant",
            content="IQR stands for Interquartile Range."
        )
        self.assertTrue(msg2["id"].startswith("msg_"))

        # List messages
        msgs = metadata_repo.list_assistant_messages(self.conv_id)
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0]["role"], "user")
        self.assertEqual(msgs[1]["role"], "assistant")

    def test_clear_assistant_history(self):
        metadata_repo.save_assistant_message(self.conv_id, "user", "Hello")
        msgs_before = metadata_repo.list_assistant_messages(self.conv_id)
        self.assertGreater(len(msgs_before), 0)

        metadata_repo.clear_assistant_history(self.conv_id)
        msgs_after = metadata_repo.list_assistant_messages(self.conv_id)
        self.assertEqual(len(msgs_after), 0)

    def test_assistant_service_fallback_knowledge_base(self):
        # Test built-in grounded knowledge retrieval
        res_iqr = assistant_service.ask_assistant("Explain 1.5x IQR outlier", conversation_id=self.conv_id)
        self.assertEqual(res_iqr["status"], "success")
        self.assertIn("Interquartile Range", res_iqr["reply"])

        res_clean = assistant_service.ask_assistant("How does data cleaning work?", conversation_id=self.conv_id)
        self.assertEqual(res_clean["status"], "success")
        self.assertIn("TableTell", res_clean["reply"])

        # History should now contain 4 messages (2 queries + 2 replies)
        history = assistant_service.get_history(conversation_id=self.conv_id)
        self.assertEqual(len(history), 4)


if __name__ == "__main__":
    unittest.main()
