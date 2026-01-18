"""Audio recorder module using PyAudio."""

import pyaudio
import wave
import os
import time
from typing import Optional, Callable
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
        self.max_duration = 0  # seconds, 0 = unlimited
        self.start_time = 0
        self.auto_stop_callback: Optional[Callable] = None

        # Create temp directory if it doesn't exist
        os.makedirs(temp_dir, exist_ok=True)

    def start(self, device_id: Optional[str] = None, device_label: Optional[str] = None,
              max_duration: int = 0, auto_stop_callback: Optional[Callable] = None) -> None:
        """
        Start recording from microphone.

        Args:
            device_id: Audio device ID (or 'default')
            device_label: Audio device label for matching
            max_duration: Maximum recording duration in seconds (0 = unlimited)
            auto_stop_callback: Function to call when auto-stopped due to duration limit
        """
        try:
            self.max_duration = max_duration
            self.auto_stop_callback = auto_stop_callback
            self.start_time = time.time()
            self.p = pyaudio.PyAudio()
            
            # Resolve device index
            input_device_index = None
            
            if (device_id and device_id != 'default') or device_label:
                logger.info(f"Looking for audio device: ID={device_id}, Label={device_label}")
                try:
                    info = self.p.get_host_api_info_by_index(0)
                    numdevices = info.get('deviceCount')
                    
                    found_device = None
                    
                    for i in range(0, numdevices):
                        device_info = self.p.get_device_info_by_host_api_device_index(0, i)
                        if device_info.get('maxInputChannels') > 0:
                            dev_name = device_info.get('name')
                            # Match against label if provided (fuzzy match)
                            if device_label and device_label.lower() in dev_name.lower():
                                found_device = i
                                logger.info(f"Found matching device by label: '{dev_name}' (Index: {i})")
                                break
                            # Fallback: check if mapped ID could work (unlikely with browser hashes)
                            
                    if found_device is not None:
                        input_device_index = found_device
                    else:
                        logger.warning(f"Device not found, falling back to default. Available devices checked: {numdevices}")
                        
                except Exception as e:
                    logger.error(f"Error enumerating devices: {e}")

            self.stream = self.p.open(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                input_device_index=input_device_index,
                frames_per_buffer=self.chunk_size
            )
            self.is_recording = True
            self.audio_data = []
            
            # Start background thread to read audio
            import threading
            self.record_thread = threading.Thread(target=self._record_loop)
            self.record_thread.start()
            
            logger.info(f"Recording started (Device: {input_device_index if input_device_index is not None else 'Default'})")
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            raise

    def _record_loop(self) -> None:
        """Background loop to read audio chunks."""
        while self.is_recording and self.stream:
            try:
                # Check if max duration exceeded
                if self.max_duration > 0:
                    elapsed = time.time() - self.start_time
                    if elapsed >= self.max_duration:
                        logger.warning(f"Recording auto-stopped: max duration ({self.max_duration}s) reached")
                        self.is_recording = False
                        # Call callback if provided
                        if self.auto_stop_callback:
                            self.auto_stop_callback(self.max_duration)
                        break

                self.read_chunk()
            except Exception as e:
                if self.is_recording: # Only log if we expect to be recording
                    logger.error(f"Error in record loop: {e}")
                break

    def stop(self) -> None:
        """Stop recording and clean up resources."""
        try:
            self.is_recording = False # Signal thread to stop
            
            if hasattr(self, 'record_thread') and self.record_thread.is_alive():
                self.record_thread.join(timeout=1.0)

            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
            if self.p:
                self.p.terminate()
            
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
                wav_file.setsampwidth(self.p.get_sample_size(pyaudio.paInt16))
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(b"".join(self.audio_data))
            logger.info(f"Audio saved to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"Failed to save audio: {e}")
            raise
