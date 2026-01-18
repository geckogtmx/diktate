import sys
import os
import unittest
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from utils.security import sanitize_log_message, redact_api_key

class TestLogRedaction(unittest.TestCase):
    def test_sanitize_log_message(self):
        # Scenario 1: OpenAI Key
        msg = "Error processing request with key sk-1234567890abcdef1234567890abcdef12"
        sanitized = sanitize_log_message(msg)
        self.assertIn("sk-[REDACTED]", sanitized)
        self.assertNotIn("sk-1234567890", sanitized)
        print(f"Original: {msg}\nSanitized: {sanitized}\n")

        # Scenario 2: Google Key (AIza...)
        msg = "Invalid credentials: AIzaSyD-1234567890abcdef1234567890abcde"
        sanitized = sanitize_log_message(msg)
        self.assertIn("AIza[REDACTED]", sanitized)
        self.assertNotIn("AIzaSyD", sanitized)
        print(f"Original: {msg}\nSanitized: {sanitized}\n")

        # Scenario 3: Bearer Token
        msg = "Authorization failed for Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        sanitized = sanitize_log_message(msg)
        self.assertIn("Bearer [REDACTED]", sanitized)
        self.assertNotIn("eyJhbGci", sanitized)
        print(f"Original: {msg}\nSanitized: {sanitized}\n")

    def test_redact_api_key(self):
        key = "sk-1234567890abcdef1234567890abcdef"
        redacted = redact_api_key(key)
        self.assertEqual(redacted, "sk-1...cdef")
        print(f"Key: {key}\nRedacted: {redacted}\n")

if __name__ == '__main__':
    unittest.main()
