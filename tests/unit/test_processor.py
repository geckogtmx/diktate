"""
Unit tests for core/processor.py

Tests all processor classes: LocalProcessor, CloudProcessor, AnthropicProcessor,
OpenAIProcessor, and the create_processor() factory function.
"""

import time
import unittest
from unittest.mock import Mock, patch, call

import pytest
import requests

from core.processor import (
    LocalProcessor,
    CloudProcessor,
    AnthropicProcessor,
    OpenAIProcessor,
    create_processor,
    validate_api_key,
)


class TestValidateApiKey(unittest.TestCase):
    """Test the validate_api_key function (OAuth token support)."""

    def test_oauth_token_accepted(self):
        """OAuth Bearer tokens (ya29.*) should be accepted for Gemini"""
        # Should not raise any error
        validate_api_key("gemini", "ya29.a0AfB_byABCDEF1234567890")

    def test_unknown_provider_skips_validation(self):
        """Unknown providers should skip validation"""
        # Should not raise any error
        validate_api_key("unknown_provider", "any-random-key-format")


class TestLocalProcessor(unittest.TestCase):
    """Test LocalProcessor class."""

    @patch("core.processor.get_prompt")
    def test_init_creates_session_with_keepalive(self, mock_get_prompt):
        """__init__ should create HTTP session with keep-alive headers"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b", mode="standard")

        assert processor.session is not None
        assert processor.session.headers["Connection"] == "keep-alive"
        assert "Keep-Alive" in processor.session.headers
        assert processor.model == "llama3.2:3b"
        assert processor.mode == "standard"
        mock_get_prompt.assert_called_once_with("standard", "llama3.2:3b")

    @patch("core.processor.get_prompt")
    def test_init_accepts_none_model(self, mock_get_prompt):
        """__init__ should accept None for model parameter (SPEC_038)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model=None)

        assert processor.model is None
        mock_get_prompt.assert_called_once_with("standard", None)

    @patch("core.processor.get_prompt")
    def test_set_mode_updates_prompt(self, mock_get_prompt):
        """set_mode should update mode and refresh prompt"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        mock_get_prompt.reset_mock()

        processor.set_mode("professional")

        assert processor.mode == "professional"
        mock_get_prompt.assert_called_once_with("professional", "llama3.2:3b")

    @patch("core.processor.get_prompt")
    def test_set_custom_prompt_accepts_valid(self, mock_get_prompt):
        """set_custom_prompt should accept valid prompt with {text} placeholder"""
        mock_get_prompt.return_value = "Default prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        processor.set_custom_prompt("Custom prompt with {text} here")

        assert processor.prompt == "Custom prompt with {text} here"

    @patch("core.processor.get_prompt")
    def test_set_custom_prompt_rejects_empty(self, mock_get_prompt):
        """set_custom_prompt should reject empty prompt"""
        mock_get_prompt.return_value = "Default prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        original_prompt = processor.prompt

        processor.set_custom_prompt("")

        assert processor.prompt == original_prompt  # Unchanged

    @patch("core.processor.get_prompt")
    def test_set_custom_prompt_rejects_missing_placeholder(self, mock_get_prompt):
        """set_custom_prompt should reject prompt missing {text} placeholder"""
        mock_get_prompt.return_value = "Default prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        original_prompt = processor.prompt

        processor.set_custom_prompt("Custom prompt without placeholder")

        assert processor.prompt == original_prompt  # Unchanged

    @patch("core.processor.get_prompt")
    def test_sanitize_for_prompt_escapes_backticks(self, mock_get_prompt):
        """_sanitize_for_prompt should escape backticks to prevent code blocks"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        result = processor._sanitize_for_prompt("Test ```code``` block")

        assert result == "Test '''code''' block"

    @patch("core.processor.get_prompt")
    def test_sanitize_for_prompt_escapes_template_markers(self, mock_get_prompt):
        """_sanitize_for_prompt should escape {text} to prevent template injection"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        result = processor._sanitize_for_prompt("User says {text} here")

        assert result == "User says [text] here"

    @patch("core.processor.get_prompt")
    def test_sanitize_handles_none_input(self, mock_get_prompt):
        """_sanitize_for_prompt should handle None/empty input"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")
        result = processor._sanitize_for_prompt("")

        assert result == ""

    @patch("core.processor.get_prompt")
    def test_process_success_extracts_tokens_per_sec(self, mock_get_prompt):
        """process() should extract tokens_per_sec from response"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")

        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "Cleaned text.",
            "eval_count": 50,
            "eval_duration": 1000000000,  # 1 second in nanoseconds
        }

        with patch.object(processor.session, "post", return_value=mock_response):
            result = processor.process("raw text")

        assert result == "Cleaned text."
        assert processor.last_tokens_per_sec == 50.0

    @patch("core.processor.get_prompt")
    @patch("time.sleep")
    def test_process_timeout_retry_with_backoff(self, mock_sleep, mock_get_prompt):
        """process() should retry with exponential backoff on timeout"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")

        # Mock timeout on first two attempts, success on third
        mock_response_success = Mock()
        mock_response_success.status_code = 200
        mock_response_success.json.return_value = {"response": "Success after retry"}

        with patch.object(
            processor.session,
            "post",
            side_effect=[requests.Timeout(), requests.Timeout(), mock_response_success],
        ):
            result = processor.process("raw text", max_retries=3)

        assert result == "Success after retry"
        # Verify exponential backoff: 1s, 2s (2 retries before success)
        assert mock_sleep.call_count == 2
        mock_sleep.assert_has_calls([call(1), call(2)])

    @patch("core.processor.get_prompt")
    @patch("time.sleep")
    def test_process_connection_error_retry(self, mock_sleep, mock_get_prompt):
        """process() should retry on ConnectionError"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")

        mock_response_success = Mock()
        mock_response_success.status_code = 200
        mock_response_success.json.return_value = {"response": "Success"}

        with patch.object(
            processor.session,
            "post",
            side_effect=[requests.ConnectionError("Connection refused"), mock_response_success],
        ):
            result = processor.process("raw text", max_retries=2)

        assert result == "Success"
        assert mock_sleep.call_count == 1

    @patch("core.processor.get_prompt")
    @patch("time.sleep")
    def test_process_max_retries_exhausted(self, mock_sleep, mock_get_prompt):
        """process() should raise exception after max retries exhausted"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")

        with patch.object(
            processor.session,
            "post",
            side_effect=[requests.Timeout(), requests.Timeout(), requests.Timeout()],
        ):
            with pytest.raises(Exception) as exc_info:
                processor.process("raw text", max_retries=3)

        assert "failed after 3 retries" in str(exc_info.value)

    @patch("core.processor.get_prompt")
    def test_process_response_parsing(self, mock_get_prompt):
        """process() should extract text from response['response']"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = LocalProcessor(model="llama3.2:3b")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "  Processed text with spaces  "}

        with patch.object(processor.session, "post", return_value=mock_response):
            result = processor.process("raw text")

        assert result == "Processed text with spaces"  # Stripped


class TestCloudProcessor(unittest.TestCase):
    """Test CloudProcessor (Gemini) class."""

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_validates_api_key(self, mock_get_prompt):
        """__init__ should validate API key format"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        # Valid API key
        processor = CloudProcessor(api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345")
        assert processor.api_key == "AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345"

        # Invalid API key format
        with pytest.raises(ValueError):
            CloudProcessor(api_key="invalid-key-format")

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_detects_oauth_token(self, mock_get_prompt):
        """__init__ should detect OAuth token (ya29.*)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(api_key="ya29.a0AfB_byABCDEF1234567890")

        assert processor.is_oauth is True
        assert processor.api_key.startswith("ya29.")

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_detects_api_key(self, mock_get_prompt):
        """__init__ should detect regular API key (not OAuth)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345")

        assert processor.is_oauth is False

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_adds_models_prefix(self, mock_get_prompt):
        """__init__ should add 'models/' prefix to model ID if missing"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(
            api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345", model="gemini-2.0-flash-exp"
        )

        assert processor.model == "models/gemini-2.0-flash-exp"

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_oauth_uses_bearer_token(self, mock_get_prompt):
        """process() should use Bearer token in Authorization header for OAuth"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(
            api_key="ya29.a0AfB_byABCDEF1234567890", model="models/gemini-2.0-flash-exp"
        )

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Processed text"}]}}]
        }

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = processor.process("raw text")

        assert result == "Processed text"
        # Verify Authorization header was used
        call_kwargs = mock_post.call_args[1]
        assert "Authorization" in call_kwargs["headers"]
        assert call_kwargs["headers"]["Authorization"] == "Bearer ya29.a0AfB_byABCDEF1234567890"

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_api_key_uses_query_param(self, mock_get_prompt):
        """process() should use API key as query parameter (not Bearer)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(
            api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345", model="models/gemini-2.0-flash-exp"
        )

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Processed text"}]}}]
        }

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = processor.process("raw text")

        assert result == "Processed text"
        # Verify API key in URL
        call_args = mock_post.call_args[0]
        assert "key=AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345" in call_args[0]

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_handle_api_error_401_oauth_invalid(self, mock_get_prompt):
        """_handle_api_error should return 'oauth_token_invalid' for 401"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(api_key="ya29.a0AfB_byABCDEF1234567890")

        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": {"code": 401, "message": "Invalid token"}}

        result = processor._handle_api_error(mock_response, 1, 3)

        assert result == "oauth_token_invalid"

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_handle_api_error_429_returns_none(self, mock_get_prompt):
        """_handle_api_error should return None for 429 (rate limit - should retry)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345")

        mock_response = Mock()
        mock_response.status_code = 429

        result = processor._handle_api_error(mock_response, 1, 3)

        assert result is None  # Continue retrying

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_handle_api_error_500_returns_none(self, mock_get_prompt):
        """_handle_api_error should return None for 500 (server error - should retry)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = CloudProcessor(api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345")

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        result = processor._handle_api_error(mock_response, 1, 3)

        assert result is None  # Continue retrying


class TestAnthropicProcessor(unittest.TestCase):
    """Test AnthropicProcessor class."""

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_validates_api_key_format(self, mock_get_prompt):
        """__init__ should validate API key starts with sk-ant-"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        # Valid key
        processor = AnthropicProcessor(api_key="sk-ant-1234567890abcdefghij")
        assert processor.api_key.startswith("sk-ant-")

        # Invalid key format
        with pytest.raises(ValueError):
            AnthropicProcessor(api_key="invalid-key-format")

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_uses_correct_headers(self, mock_get_prompt):
        """process() should use x-api-key and anthropic-version headers"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = AnthropicProcessor(api_key="sk-ant-1234567890abcdefghij")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": [{"type": "text", "text": "Processed text"}]}

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = processor.process("raw text")

        assert result == "Processed text"
        # Verify headers
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["headers"]["x-api-key"] == "sk-ant-1234567890abcdefghij"
        assert call_kwargs["headers"]["anthropic-version"] == "2023-06-01"

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_response_parsing(self, mock_get_prompt):
        """process() should parse response from content[0].text"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = AnthropicProcessor(api_key="sk-ant-1234567890abcdefghij")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "content": [{"type": "text", "text": "  Result with spaces  "}]
        }

        with patch("requests.post", return_value=mock_response):
            result = processor.process("raw text")

        assert result == "Result with spaces"  # Stripped


class TestOpenAIProcessor(unittest.TestCase):
    """Test OpenAIProcessor class."""

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_validates_api_key_format(self, mock_get_prompt):
        """__init__ should validate API key starts with sk-"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        # Valid key
        processor = OpenAIProcessor(api_key="sk-12345678901234567890")
        assert processor.api_key.startswith("sk-")

        # Invalid key format
        with pytest.raises(ValueError):
            OpenAIProcessor(api_key="invalid-key-format")

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_init_validates_model_format(self, mock_get_prompt):
        """__init__ should validate model ID format (gpt-*)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        # Valid model
        processor = OpenAIProcessor(api_key="sk-12345678901234567890", model="gpt-4o-mini")
        assert processor.model == "gpt-4o-mini"

        # Invalid model falls back to default
        processor = OpenAIProcessor(api_key="sk-12345678901234567890", model="invalid_model!")
        assert processor.model == "gpt-4o-mini"  # Fallback

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_request_body_structure(self, mock_get_prompt):
        """process() should send correct request body structure"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = OpenAIProcessor(api_key="sk-12345678901234567890")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Processed text"}}]
        }

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = processor.process("raw text")

        assert result == "Processed text"
        # Verify request body
        call_kwargs = mock_post.call_args[1]
        assert "model" in call_kwargs["json"]
        assert "messages" in call_kwargs["json"]
        assert call_kwargs["json"]["temperature"] == 0.1

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_process_response_parsing(self, mock_get_prompt):
        """process() should parse response from choices[0].message.content"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = OpenAIProcessor(api_key="sk-12345678901234567890")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "  OpenAI result  "}}]
        }

        with patch("requests.post", return_value=mock_response):
            result = processor.process("raw text")

        assert result == "OpenAI result"  # Stripped


class TestCreateProcessorFactory(unittest.TestCase):
    """Test the create_processor() factory function."""

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_creates_local_processor(self, mock_get_prompt):
        """create_processor('local') should return LocalProcessor instance"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(provider_name="local", model="llama3.2:3b")

        assert isinstance(processor, LocalProcessor)
        assert processor.model == "llama3.2:3b"

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_creates_gemini_processor(self, mock_get_prompt):
        """create_processor('gemini') should return CloudProcessor instance"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(
            provider_name="gemini", api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345"
        )

        assert isinstance(processor, CloudProcessor)

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_creates_cloud_processor_alias(self, mock_get_prompt):
        """create_processor('cloud') should return CloudProcessor instance (alias)"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(
            provider_name="cloud", api_key="AIzaSyDaGmRU-Fk9Xk1234567890abcdef12345"
        )

        assert isinstance(processor, CloudProcessor)

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_creates_anthropic_processor(self, mock_get_prompt):
        """create_processor('anthropic') should return AnthropicProcessor instance"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(
            provider_name="anthropic", api_key="sk-ant-1234567890abcdefghij"
        )

        assert isinstance(processor, AnthropicProcessor)

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_creates_openai_processor(self, mock_get_prompt):
        """create_processor('openai') should return OpenAIProcessor instance"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(provider_name="openai", api_key="sk-12345678901234567890")

        assert isinstance(processor, OpenAIProcessor)

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {"PROCESSING_MODE": "local"}, clear=True)
    def test_factory_falls_back_to_local_for_unknown(self, mock_get_prompt):
        """create_processor('unknown') should fallback to LocalProcessor"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(provider_name="unknown")

        assert isinstance(processor, LocalProcessor)

    @patch("core.processor.get_prompt")
    @patch.dict("os.environ", {}, clear=True)
    def test_factory_passes_kwargs(self, mock_get_prompt):
        """Factory should pass through kwargs to constructors"""
        mock_get_prompt.return_value = "Test prompt with {text}"

        processor = create_processor(provider_name="local", model="custom-model:v2")

        assert processor.model == "custom-model:v2"


if __name__ == "__main__":
    unittest.main()
