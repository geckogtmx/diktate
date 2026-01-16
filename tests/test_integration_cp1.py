"""Test Checkpoint 1: Record → Transcribe integration test."""

import sys
import os
import pytest
import tempfile
from pathlib import Path

# Add python module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

from core import Recorder, Transcriber


class TestRecorderTranscriber:
    """Integration tests for Recorder and Transcriber."""

    @pytest.fixture
    def temp_audio_dir(self):
        """Create temporary directory for test audio files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_recorder_initialization(self, temp_audio_dir):
        """Test that Recorder initializes without errors."""
        recorder = Recorder(temp_dir=temp_audio_dir)
        assert recorder is not None
        assert not recorder.is_recording
        assert recorder.sample_rate == 16000
        assert recorder.channels == 1

    def test_transcriber_initialization(self):
        """Test that Transcriber initializes and loads model."""
        transcriber = Transcriber(model_size="medium", device="auto")
        assert transcriber is not None
        assert transcriber.model is not None
        assert transcriber.model_size == "medium"

    def test_recorder_start_stop(self, temp_audio_dir):
        """Test that Recorder can start and stop recording."""
        recorder = Recorder(temp_dir=temp_audio_dir)
        recorder.start()
        assert recorder.is_recording
        recorder.stop()
        assert not recorder.is_recording

    def test_transcriber_with_sample(self, temp_audio_dir):
        """Test transcription with a sample audio file."""
        # This test requires a real audio file
        # Skipped in CI/CD, useful for manual testing

        # Create a simple test audio file (silence)
        import wave
        sample_rate = 16000
        duration = 3  # seconds
        channels = 1

        test_file = os.path.join(temp_audio_dir, "test_audio.wav")

        # Generate silence (zeros)
        with wave.open(test_file, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            silence = b'\x00\x00' * (sample_rate * duration)
            wav_file.writeframes(silence)

        # Test transcription
        transcriber = Transcriber(model_size="medium", device="auto")
        result = transcriber.transcribe(test_file)

        # Result should be string (even if empty for silence)
        assert isinstance(result, str)

    def test_recorder_file_save(self, temp_audio_dir):
        """Test that Recorder can save audio to file."""
        recorder = Recorder(temp_dir=temp_audio_dir)
        recorder.start()

        # Simulate some audio recording (read 10 chunks)
        for _ in range(10):
            recorder.read_chunk()

        recorder.stop()

        # Save to file
        output_file = os.path.join(temp_audio_dir, "test_recording.wav")
        saved_path = recorder.save_to_file(output_file)

        # Verify file was created
        assert os.path.exists(saved_path)
        assert os.path.getsize(saved_path) > 0


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
