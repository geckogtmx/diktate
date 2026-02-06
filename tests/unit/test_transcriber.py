"""
Unit tests for core/transcriber.py

Tests the Transcriber class for Whisper model loading and transcription.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

# Direct import to avoid triggering core/__init__.py which imports pyaudio-dependent Recorder
# Add python directory to path (tests/conftest.py already does this, but being explicit)
if str(Path(__file__).parent.parent.parent / "python") not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

# Import directly from module, not via core package (avoids __init__.py execution)
import core.transcriber

Transcriber = core.transcriber.Transcriber


class TestTranscriberInit(unittest.TestCase):
    """Test Transcriber initialization."""

    @patch("core.transcriber.WhisperModel")
    @patch("ctranslate2.get_cuda_device_count")
    def test_init_with_cuda_available(self, mock_cuda_count, mock_whisper_model):
        """__init__ should detect and use CUDA when available"""
        mock_cuda_count.return_value = 1
        mock_whisper_model.return_value = Mock()

        transcriber = Transcriber(model_size="base", device="auto")

        assert transcriber.model_size == "base"
        assert transcriber.device == "auto"
        assert transcriber.model is not None
        # Verify CUDA was detected and used
        mock_whisper_model.assert_called()
        call_kwargs = mock_whisper_model.call_args[1]
        assert call_kwargs["device"] == "cuda"

    @patch("core.transcriber.WhisperModel")
    @patch("ctranslate2.get_cuda_device_count")
    def test_init_fallback_to_cpu_no_cuda(self, mock_cuda_count, mock_whisper_model):
        """__init__ should fallback to CPU when CUDA not available"""
        mock_cuda_count.return_value = 0
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="base", device="auto")

        # Verify CPU was used as fallback
        call_kwargs = mock_whisper_model.call_args[1]
        assert call_kwargs["device"] == "cpu"

    @patch("core.transcriber.WhisperModel")
    def test_init_explicit_cuda_device(self, mock_whisper_model):
        """__init__ should use explicit device when specified"""
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="base", device="cuda")

        # Verify explicit device was passed through
        call_kwargs = mock_whisper_model.call_args[1]
        assert call_kwargs["device"] == "cuda"

    @patch("core.transcriber.WhisperModel")
    def test_init_explicit_cpu_device(self, mock_whisper_model):
        """__init__ should use explicit CPU device"""
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="base", device="cpu")

        call_kwargs = mock_whisper_model.call_args[1]
        assert call_kwargs["device"] == "cpu"
        assert call_kwargs["compute_type"] == "int8"

    def test_init_invalid_model_size(self):
        """__init__ should reject invalid model size"""
        with pytest.raises(ValueError) as exc_info:
            Transcriber(model_size="invalid_model")

        assert "Model size must be one of" in str(exc_info.value)

    @patch("core.transcriber.WhisperModel")
    def test_init_loads_standard_model(self, mock_whisper_model):
        """__init__ should load standard model sizes"""
        mock_whisper_model.return_value = Mock()

        for model_size in ["tiny", "base", "small", "medium", "large"]:
            transcriber = Transcriber(model_size=model_size, device="cpu")
            assert transcriber.model_size == model_size


class TestModelMapping(unittest.TestCase):
    """Test MODEL_MAPPING constant."""

    @patch("core.transcriber.WhisperModel")
    def test_model_mapping_turbo_resolves_to_hf_path(self, mock_whisper_model):
        """MODEL_MAPPING should resolve 'turbo' to HF path"""
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="turbo", device="cpu")

        # Verify turbo was resolved to the HF path
        call_args = mock_whisper_model.call_args[0]
        assert call_args[0] == "deepdml/faster-whisper-large-v3-turbo-ct2"

    @patch("core.transcriber.WhisperModel")
    def test_model_mapping_standard_model_unchanged(self, mock_whisper_model):
        """Standard models should not be mapped"""
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="base", device="cpu")

        # Verify base was not mapped
        call_args = mock_whisper_model.call_args[0]
        assert call_args[0] == "base"


class TestLoadModel(unittest.TestCase):
    """Test _load_model method."""

    @patch("core.transcriber.WhisperModel")
    def test_load_model_tries_local_first(self, mock_whisper_model):
        """_load_model should try local_files_only=True first"""
        mock_whisper_model.return_value = Mock()

        Transcriber(model_size="base", device="cpu")

        # Verify local_files_only=True was tried first
        first_call_kwargs = mock_whisper_model.call_args_list[0][1]
        assert first_call_kwargs["local_files_only"] is True

    @patch("core.transcriber.WhisperModel")
    def test_load_model_falls_back_to_online(self, mock_whisper_model):
        """_load_model should fallback to online if local fails"""
        # First call fails (local not found), second succeeds (online)
        mock_whisper_model.side_effect = [
            Exception("Local model not found"),
            Mock(),  # Success on online load
        ]

        Transcriber(model_size="base", device="cpu")

        # Verify both local and online were tried
        assert mock_whisper_model.call_count == 2
        # First call: local_files_only=True
        assert mock_whisper_model.call_args_list[0][1]["local_files_only"] is True
        # Second call: local_files_only=False
        assert mock_whisper_model.call_args_list[1][1]["local_files_only"] is False

    @patch("core.transcriber.WhisperModel")
    def test_load_model_raises_on_complete_failure(self, mock_whisper_model):
        """_load_model should raise if both local and online fail"""
        mock_whisper_model.side_effect = Exception("Model load failed")

        with pytest.raises(Exception) as exc_info:
            Transcriber(model_size="base", device="cpu")

        assert "Model load failed" in str(exc_info.value)


class TestTranscribe(unittest.TestCase):
    """Test transcribe method."""

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_success_returns_combined_text(self, mock_whisper_model):
        """transcribe() should combine all segments into single string"""
        # Mock model instance
        mock_model_instance = Mock()

        # Mock segments (simplified segment objects)
        mock_segment1 = Mock()
        mock_segment1.text = "Hello world."
        mock_segment2 = Mock()
        mock_segment2.text = "This is a test."

        mock_info = Mock()

        # transcribe returns (segments, info) - segments is an iterable
        mock_model_instance.transcribe.return_value = ([mock_segment1, mock_segment2], mock_info)

        mock_whisper_model.return_value = mock_model_instance

        transcriber = Transcriber(model_size="base", device="cpu")
        result = transcriber.transcribe("test.wav")

        assert result == "Hello world. This is a test."
        mock_model_instance.transcribe.assert_called_once_with(
            "test.wav", language=None, task="transcribe"
        )

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_with_language_parameter(self, mock_whisper_model):
        """transcribe() should pass language parameter to model"""
        mock_model_instance = Mock()
        mock_segment = Mock()
        mock_segment.text = "Test text"
        mock_info = Mock()

        mock_model_instance.transcribe.return_value = ([mock_segment], mock_info)
        mock_whisper_model.return_value = mock_model_instance

        transcriber = Transcriber(model_size="base", device="cpu")
        result = transcriber.transcribe("test.wav", language="en")

        assert result == "Test text"
        mock_model_instance.transcribe.assert_called_once_with(
            "test.wav", language="en", task="transcribe"
        )

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_empty_segments(self, mock_whisper_model):
        """transcribe() should handle empty segments (no speech detected)"""
        mock_model_instance = Mock()
        mock_info = Mock()

        # Empty segment list
        mock_model_instance.transcribe.return_value = ([], mock_info)
        mock_whisper_model.return_value = mock_model_instance

        transcriber = Transcriber(model_size="base", device="cpu")
        result = transcriber.transcribe("silent.wav")

        assert result == ""

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_single_segment(self, mock_whisper_model):
        """transcribe() should handle single segment"""
        mock_model_instance = Mock()
        mock_segment = Mock()
        mock_segment.text = "Single utterance"
        mock_info = Mock()

        mock_model_instance.transcribe.return_value = ([mock_segment], mock_info)
        mock_whisper_model.return_value = mock_model_instance

        transcriber = Transcriber(model_size="base", device="cpu")
        result = transcriber.transcribe("test.wav")

        assert result == "Single utterance"

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_raises_if_model_not_loaded(self, mock_whisper_model):
        """transcribe() should raise if model is None"""
        mock_whisper_model.return_value = Mock()

        transcriber = Transcriber(model_size="base", device="cpu")
        transcriber.model = None  # Simulate model not loaded

        with pytest.raises(RuntimeError) as exc_info:
            transcriber.transcribe("test.wav")

        assert "Model not loaded" in str(exc_info.value)

    @patch("core.transcriber.WhisperModel")
    def test_transcribe_raises_on_error(self, mock_whisper_model):
        """transcribe() should raise exception on transcription failure"""
        mock_model_instance = Mock()
        mock_model_instance.transcribe.side_effect = Exception("Transcription failed")
        mock_whisper_model.return_value = mock_model_instance

        transcriber = Transcriber(model_size="base", device="cpu")

        with pytest.raises(Exception) as exc_info:
            transcriber.transcribe("test.wav")

        assert "Transcription failed" in str(exc_info.value)


class TestSupportedModels(unittest.TestCase):
    """Test SUPPORTED_MODELS constant."""

    def test_supported_models_list(self):
        """SUPPORTED_MODELS should contain expected model sizes"""
        expected = ["tiny", "base", "small", "medium", "large", "turbo"]
        assert Transcriber.SUPPORTED_MODELS == expected


if __name__ == "__main__":
    unittest.main()
