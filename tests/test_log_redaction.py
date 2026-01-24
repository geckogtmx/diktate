import sys
import os
import unittest
from unittest.mock import patch
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from utils.security import sanitize_log_message, redact_api_key, redact_text

class TestLogRedaction(unittest.TestCase):
    def test_sanitize_log_message(self):
        # Scenario 1: OpenAI Key
        msg = "Error processing request with key sk-1234567890abcdef1234567890abcdef12"
        sanitized = sanitize_log_message(msg)
        self.assertIn("sk-[REDACTED]", sanitized)
        self.assertNotIn("sk-1234567890", sanitized)

        # Scenario 2: Google Key (AIza...)
        msg = "Invalid credentials: AIzaSyD-1234567890abcdef1234567890abcde"
        sanitized = sanitize_log_message(msg)
        self.assertIn("AIza[REDACTED]", sanitized)
        self.assertNotIn("AIzaSyD", sanitized)

        # Scenario 3: Bearer Token
        msg = "Authorization failed for Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        sanitized = sanitize_log_message(msg)
        self.assertIn("Bearer [REDACTED]", sanitized)
        self.assertNotIn("eyJhbGci", sanitized)

        # Scenario 4: Anthropic Key (sk-ant-...) [NEW TEST]
        msg = "Config loaded with key sk-ant-api03-abcdef123456-7890xyz"
        sanitized = sanitize_log_message(msg)
        self.assertIn("sk-ant-[REDACTED]", sanitized)
        self.assertNotIn("api03-abcdef", sanitized)

    def test_redact_api_key(self):
        key = "sk-1234567890abcdef1234567890abcdef"
        redacted = redact_api_key(key)
        self.assertEqual(redacted, "sk-1...cdef")

    def test_redact_text_defaults(self):
        """Test default redaction behavior (safe)"""
        text = "This is a secret message that should be redacted"
        # Ensure env var is cleared for this test
        with patch.dict(os.environ, {}, clear=True):
             redacted = redact_text(text, max_visible=10)
             self.assertTrue("REDACTED" in redacted)
             self.assertFalse("secret message" in redacted)
             self.assertTrue(text[:10] in redacted)

    def test_redact_text_debug_safely(self):
        """Test that DIKTATE_DEBUG=1 is STILL safe (redacted)"""
        text = "This is a secret message that should be redacted"
        with patch.dict(os.environ, {"DIKTATE_DEBUG": "1"}):
             redacted = redact_text(text, max_visible=10)
             self.assertTrue("REDACTED" in redacted)
             self.assertFalse("secret message" in redacted)

    def test_redact_text_unsafe(self):
        """Test that DIKTATE_DEBUG_UNSAFE=1 shows full text"""
        text = "This is a secret message that should be redacted"
        with patch.dict(os.environ, {"DIKTATE_DEBUG_UNSAFE": "1"}):
             redacted = redact_text(text)
             self.assertEqual(redacted, text)

if __name__ == '__main__':
    unittest.main()
