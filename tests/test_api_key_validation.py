"""
Unit tests for API key validation (SPEC_013)

Tests the validate_api_key() function in python/core/processor.py
"""

import unittest

from core.processor import validate_api_key


class TestGeminiKeyValidation(unittest.TestCase):
    """Test Gemini API key format validation"""

    def test_valid_key(self):
        """Valid Gemini key should pass without error"""
        # AIza + 35 characters (letters, numbers, -, _)
        validate_api_key('gemini', 'AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345')

    def test_valid_key_with_underscores(self):
        """Valid Gemini key with underscores should pass"""
        validate_api_key('gemini', 'AIza_yDaGmRU_Fk9Xk1234567890abcdef12345')

    def test_valid_key_with_mixed_case(self):
        """Valid Gemini key with mixed case should pass"""
        # AIza + exactly 35 characters
        validate_api_key('gemini', 'AIzaSyDaGmRUFk9XK1234567890ABCDEF123456')

    def test_invalid_prefix(self):
        """Gemini key with wrong prefix should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', 'sk-ant-1234567890123456789012345678901234')
        self.assertIn("Invalid gemini API key format", str(cm.exception))

    def test_too_short(self):
        """Gemini key that's too short should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', 'AIza123')
        self.assertIn("Invalid gemini API key format", str(cm.exception))

    def test_too_long(self):
        """Gemini key that's too long should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', 'AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345EXTRA')
        self.assertIn("Invalid gemini API key format", str(cm.exception))

    def test_invalid_characters(self):
        """Gemini key with special characters should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', 'AIza!@#$%^&*()1234567890123456789012345')
        self.assertIn("Invalid gemini API key format", str(cm.exception))

    def test_empty_string(self):
        """Empty string should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', '')
        self.assertIn("Invalid gemini API key format", str(cm.exception))


class TestAnthropicKeyValidation(unittest.TestCase):
    """Test Anthropic API key format validation"""

    def test_valid_key_minimal(self):
        """Valid Anthropic key with minimum length should pass"""
        # sk-ant- + 20 characters
        validate_api_key('anthropic', 'sk-ant-1234567890abcdefghij')

    def test_valid_key_longer(self):
        """Valid Anthropic key with more than 20 characters should pass"""
        validate_api_key('anthropic', 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz')

    def test_valid_key_with_hyphens_underscores(self):
        """Valid Anthropic key with hyphens and underscores should pass"""
        validate_api_key('anthropic', 'sk-ant-api03-ABC_123-XYZ_789-test')

    def test_invalid_prefix_openai(self):
        """Anthropic key with OpenAI prefix should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', 'sk-12345678901234567890')
        self.assertIn("Invalid anthropic API key format", str(cm.exception))

    def test_invalid_prefix_gemini(self):
        """Anthropic key with Gemini prefix should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', 'AIza12345678901234567890123456789012345')
        self.assertIn("Invalid anthropic API key format", str(cm.exception))

    def test_too_short(self):
        """Anthropic key that's too short should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', 'sk-ant-abc')
        self.assertIn("Invalid anthropic API key format", str(cm.exception))

    def test_invalid_characters(self):
        """Anthropic key with special characters should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', 'sk-ant-!@#$%^&*()1234567890')
        self.assertIn("Invalid anthropic API key format", str(cm.exception))

    def test_empty_string(self):
        """Empty string should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', '')
        self.assertIn("Invalid anthropic API key format", str(cm.exception))


class TestOpenAIKeyValidation(unittest.TestCase):
    """Test OpenAI API key format validation"""

    def test_valid_key_minimal(self):
        """Valid OpenAI key with minimum length should pass"""
        # sk- + 20 alphanumeric characters
        validate_api_key('openai', 'sk-12345678901234567890')

    def test_valid_key_longer(self):
        """Valid OpenAI key with more than 20 characters should pass"""
        validate_api_key('openai', 'sk-proj1234567890abcdefghijklmnopqrstuvwxyz')

    def test_valid_key_mixed_case(self):
        """Valid OpenAI key with mixed case should pass"""
        # sk- + at least 20 alphanumeric characters
        validate_api_key('openai', 'sk-ABC123XYZ456def78901')

    def test_invalid_prefix_anthropic(self):
        """OpenAI key with Anthropic prefix should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'sk-ant-1234567890abcdefghij')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_invalid_prefix_gemini(self):
        """OpenAI key with Gemini prefix should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'AIza12345678901234567890123456789012345')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_too_short(self):
        """OpenAI key that's too short should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'sk-123')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_invalid_characters_hyphen(self):
        """OpenAI key with hyphens (besides prefix) should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'sk-1234-5678-9012-3456-7890')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_invalid_characters_underscore(self):
        """OpenAI key with underscores should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'sk-1234_5678_9012_3456_7890')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_invalid_characters_special(self):
        """OpenAI key with special characters should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', 'sk-!@#$%^&*()1234567890')
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_empty_string(self):
        """Empty string should fail"""
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', '')
        self.assertIn("Invalid openai API key format", str(cm.exception))


class TestUnknownProvider(unittest.TestCase):
    """Test validation behavior for unknown providers"""

    def test_unknown_provider_skips_validation(self):
        """Unknown provider should skip validation (no error)"""
        # Should not raise any error
        validate_api_key('unknown', 'any-key-format-12345')
        validate_api_key('foobar', 'test')
        validate_api_key('custom', '')


class TestCrossProviderValidation(unittest.TestCase):
    """Test that keys from one provider don't validate for another"""

    def test_gemini_key_for_anthropic(self):
        """Valid Gemini key should fail for Anthropic"""
        gemini_key = 'AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345'
        validate_api_key('gemini', gemini_key)  # Should pass
        with self.assertRaises(ValueError) as cm:
            validate_api_key('anthropic', gemini_key)
        self.assertIn("Invalid anthropic API key format", str(cm.exception))

    def test_anthropic_key_for_openai(self):
        """Valid Anthropic key should fail for OpenAI"""
        anthropic_key = 'sk-ant-1234567890abcdefghij'
        validate_api_key('anthropic', anthropic_key)  # Should pass
        with self.assertRaises(ValueError) as cm:
            validate_api_key('openai', anthropic_key)
        self.assertIn("Invalid openai API key format", str(cm.exception))

    def test_openai_key_for_gemini(self):
        """Valid OpenAI key should fail for Gemini"""
        openai_key = 'sk-12345678901234567890'
        validate_api_key('openai', openai_key)  # Should pass
        with self.assertRaises(ValueError) as cm:
            validate_api_key('gemini', openai_key)
        self.assertIn("Invalid gemini API key format", str(cm.exception))


if __name__ == '__main__':
    unittest.main()
