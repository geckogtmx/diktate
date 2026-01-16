"""Audio recorder module using PyAudio."""

import pyaudio
import wave
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class Recorder:
    """Records audio from the default microphone."""

    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
        chunk_size: int = 1024,
        temp_dir: str = "./temp_audio"
    ):
        """
        Initialize the recorder.

        Args:
            sample_rate: Sample rate in Hz (default: 16000 for Whisper)
            channels: Number of audio channels (1 = mono, 2 = stereo)
            chunk_size: Number of frames per buffer
            temp_dir: Directory for temporary audio files
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.temp_dir = temp_dir
        self.is_recording = False
        self.audio_data = []
        self.p: Optional[pyaudio.PyAudio] = None
        self.stream: Optional[pyaudio.Stream] = None

        # Create temp directory if it doesn't exist
        os.makedirs(temp_dir, exist_ok=True)

    def start(self) -> None:
        """Start recording from microphone."""
        try:
            self.p = pyaudio.PyAudio()
            self.stream = self.p.open(
                format=pyaudio.paFloat32,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size
            )
            self.is_recording = True
            self.audio_data = []
            logger.info("Recording started")
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            raise

    def stop(self) -> None:
        """Stop recording and clean up resources."""
        try:
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
            if self.p:
                self.p.terminate()
            self.is_recording = False
            logger.info("Recording stopped")
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")

    def read_chunk(self) -> bytes:
        """
        Read a chunk of audio data from the stream.

        Returns:
            Audio data as bytes

        Raises:
            RuntimeError: If not currently recording
        """
        if not self.is_recording or not self.stream:
            raise RuntimeError("Recorder is not active")

        try:
            data = self.stream.read(self.chunk_size, exception_on_overflow=False)
            self.audio_data.append(data)
            return data
        except Exception as e:
            logger.error(f"Error reading chunk: {e}")
            raise

    def save_to_file(self, filepath: str) -> str:
        """
        Save recorded audio to a WAV file.

        Args:
            filepath: Path to save the audio file

        Returns:
            Path to the saved file
        """
        try:
            with wave.open(filepath, "wb") as wav_file:
                wav_file.setnchannels(self.channels)
                wav_file.setsampwidth(self.p.get_sample_size(pyaudio.paFloat32))
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(b"".join(self.audio_data))
            logger.info(f"Audio saved to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"Failed to save audio: {e}")
            raise
