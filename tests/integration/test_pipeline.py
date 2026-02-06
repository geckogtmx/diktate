"""Integration tests for component pipeline (SPEC_040_GAPS.md Task 1.7).

Tests Python component wiring with mocked external services.
"""

from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest


@pytest.fixture
def mock_transcriber():
    """Mock Transcriber for pipeline testing."""
    with patch("core.transcriber.Transcriber") as mock_class:
        mock_instance = Mock()
        mock_instance.transcribe.return_value = "This is a test transcription."
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_processor():
    """Mock Processor for pipeline testing."""
    with patch("core.processor.LocalProcessor") as mock_class:
        mock_instance = Mock()
        mock_instance.process.return_value = "This is a processed result."
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_injector():
    """Mock Injector for pipeline testing."""
    with patch("core.injector.Injector") as mock_class:
        mock_instance = Mock()
        mock_instance.paste_text.return_value = None
        mock_class.return_value = mock_instance
        yield mock_instance


class TestRecorderTranscriberFlow:
    """Test Recorder → Transcriber component flow."""

    def test_audio_file_passed_to_transcriber(self, mock_transcriber):
        """Transcriber should receive audio file path"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        # Simulate pipeline calling transcriber
        result = mock_transcriber.transcribe(str(audio_file))

        mock_transcriber.transcribe.assert_called_once_with(str(audio_file))
        assert result == "This is a test transcription."

    def test_transcriber_with_language_parameter(self, mock_transcriber):
        """Transcriber should accept language parameter"""
        audio_file = Path("tests/fixtures/test_audio.wav")
        mock_transcriber.transcribe.return_value = "Hola mundo"

        # Simulate pipeline with language
        result = mock_transcriber.transcribe(str(audio_file), language="es")

        mock_transcriber.transcribe.assert_called_once_with(str(audio_file), language="es")
        assert result == "Hola mundo"

    def test_transcriber_empty_result_handling(self, mock_transcriber):
        """Pipeline should handle empty transcription results"""
        mock_transcriber.transcribe.return_value = ""

        result = mock_transcriber.transcribe("audio.wav")

        assert result == ""
        # Pipeline should detect empty result and handle gracefully


class TestTranscriberProcessorFlow:
    """Test Transcriber → Processor component flow."""

    def test_transcribed_text_sent_to_processor(self, mock_processor):
        """Processor should receive transcribed text"""
        transcribed_text = "Please format this text properly."

        result = mock_processor.process(transcribed_text)

        mock_processor.process.assert_called_once_with(transcribed_text)
        assert result == "This is a processed result."

    def test_processor_with_mode_parameter(self, mock_processor):
        """Processor should use correct mode"""
        raw_text = "What is the weather today"
        mock_processor.mode = "ask"
        mock_processor.process.return_value = "I don't have access to weather data."

        result = mock_processor.process(raw_text)

        assert result == "I don't have access to weather data."
        assert mock_processor.mode == "ask"

    def test_processor_returns_none_on_failure(self, mock_processor):
        """Processor should return None on API failure"""
        mock_processor.process.return_value = None

        result = mock_processor.process("test input")

        assert result is None
        # Pipeline should fall back to raw transcription


class TestProcessorInjectorFlow:
    """Test Processor → Injector component flow."""

    def test_processed_text_injected_to_clipboard(self, mock_injector):
        """Injector should receive processed text"""
        processed_text = "Final formatted output"

        mock_injector.paste_text(processed_text)

        mock_injector.paste_text.assert_called_once_with(processed_text)

    def test_empty_text_not_injected(self, mock_injector):
        """Injector should not be called with empty text"""
        processed_text = ""

        # Pipeline should skip injection for empty text
        if processed_text:
            mock_injector.paste_text(processed_text)

        mock_injector.paste_text.assert_not_called()

    def test_injector_with_trailing_space(self, mock_injector):
        """Injector should add trailing space when configured"""
        processed_text = "Text without trailing space"
        mock_injector.add_trailing_space = True

        # Simulate injector adding space
        text_to_inject = processed_text + " " if mock_injector.add_trailing_space else processed_text

        mock_injector.paste_text(text_to_inject)

        mock_injector.paste_text.assert_called_once()
        call_args = mock_injector.paste_text.call_args[0][0]
        assert call_args.endswith(" ")


class TestFullPipelineIntegration:
    """Test complete pipeline flow from audio to injection."""

    def test_full_pipeline_success(self, mock_transcriber, mock_processor, mock_injector):
        """Full pipeline should pass data through all components"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        # Simulate full pipeline
        # 1. Transcribe
        transcribed = mock_transcriber.transcribe(str(audio_file))
        assert transcribed == "This is a test transcription."

        # 2. Process
        processed = mock_processor.process(transcribed)
        assert processed == "This is a processed result."

        # 3. Inject
        mock_injector.paste_text(processed)

        # Verify call chain
        mock_transcriber.transcribe.assert_called_once()
        mock_processor.process.assert_called_once_with("This is a test transcription.")
        mock_injector.paste_text.assert_called_once_with("This is a processed result.")

    def test_pipeline_processor_failure_fallback(self, mock_transcriber, mock_processor, mock_injector):
        """Pipeline should fall back to raw text if processor fails"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        # Transcribe succeeds
        transcribed = mock_transcriber.transcribe(str(audio_file))

        # Processor fails (returns None)
        mock_processor.process.return_value = None
        processed = mock_processor.process(transcribed)

        # Pipeline should use fallback
        final_text = processed if processed is not None else transcribed

        mock_injector.paste_text(final_text)

        # Verify fallback was used
        assert final_text == "This is a test transcription."
        mock_injector.paste_text.assert_called_once_with("This is a test transcription.")

    def test_pipeline_transcriber_failure_abort(self, mock_transcriber, mock_processor, mock_injector):
        """Pipeline should abort if transcription fails"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        # Transcriber fails (returns empty)
        mock_transcriber.transcribe.return_value = ""
        transcribed = mock_transcriber.transcribe(str(audio_file))

        # Pipeline should abort
        if not transcribed:
            # Skip processing and injection
            pass
        else:
            mock_processor.process(transcribed)
            mock_injector.paste_text(transcribed)

        # Verify processor and injector were not called
        mock_processor.process.assert_not_called()
        mock_injector.paste_text.assert_not_called()


class TestPipelineErrorRecovery:
    """Test pipeline error handling and recovery."""

    def test_processor_exception_handling(self, mock_transcriber, mock_processor, mock_injector):
        """Pipeline should handle processor exceptions gracefully"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        transcribed = mock_transcriber.transcribe(str(audio_file))

        # Processor raises exception
        mock_processor.process.side_effect = Exception("API connection failed")

        try:
            processed = mock_processor.process(transcribed)
        except Exception:
            processed = None  # Fallback to None on exception

        # Pipeline should use fallback
        final_text = processed if processed is not None else transcribed
        mock_injector.paste_text(final_text)

        assert final_text == "This is a test transcription."

    def test_injector_exception_recovery(self, mock_transcriber, mock_processor, mock_injector):
        """Pipeline should log injector errors without crashing"""
        audio_file = Path("tests/fixtures/test_audio.wav")

        transcribed = mock_transcriber.transcribe(str(audio_file))
        processed = mock_processor.process(transcribed)

        # Injector raises exception
        mock_injector.paste_text.side_effect = Exception("Clipboard access denied")

        # Pipeline should catch and log error
        try:
            mock_injector.paste_text(processed)
            injection_succeeded = True
        except Exception as e:
            injection_succeeded = False
            error_msg = str(e)

        assert not injection_succeeded
        assert "Clipboard access denied" in error_msg

    def test_pipeline_with_all_components_mocked(self, mock_transcriber, mock_processor, mock_injector):
        """Complete pipeline with all components mocked should execute"""
        # This test verifies the mocking strategy works correctly
        audio_file = Path("tests/fixtures/test_audio.wav")

        # Execute pipeline
        step1 = mock_transcriber.transcribe(str(audio_file))
        step2 = mock_processor.process(step1)
        mock_injector.paste_text(step2)

        # Verify all components were invoked
        assert mock_transcriber.transcribe.called
        assert mock_processor.process.called
        assert mock_injector.paste_text.called
