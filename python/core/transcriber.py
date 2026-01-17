"""Transcriber module using faster-whisper."""

from faster_whisper import WhisperModel
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class Transcriber:
    """Transcribes audio using OpenAI Whisper."""

    # Supported models: tiny, base, small, medium, large, turbo
    SUPPORTED_MODELS = ["tiny", "base", "small", "medium", "large", "turbo"]
    
    # Mapping for special model names to HF paths
    MODEL_MAPPING = {
        "turbo": "deepdml/faster-whisper-large-v3-turbo-ct2"
    }

    def __init__(self, model_size: str = "medium", device: str = "auto"):
        """
        Initialize the transcriber.

        Args:
            model_size: Size of the Whisper model (default: medium)
            device: Device to use ('cuda', 'cpu', or 'auto')
        """
        if model_size not in self.SUPPORTED_MODELS:
            raise ValueError(f"Model size must be one of {self.SUPPORTED_MODELS}")

        self.model_size = model_size
        self.device = device
        self.model: Optional[WhisperModel] = None
        self._load_model()

    def _load_model(self) -> None:
        """Load the Whisper model."""
        try:
            # Force CPU device if auto-detection picks up incompatible CUDA
            device = "cpu" if self.device == "auto" else self.device
            
            # Resolve model path from mapping if it exists, otherwise use size name
            model_name = self.MODEL_MAPPING.get(self.model_size, self.model_size)

            logger.info(f"Loading Whisper model '{model_name}' on {device}...")
            self.model = WhisperModel(
                model_name,
                device=device,
                compute_type="int8"  # Use int8 quantized for CPU efficiency
            )
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

    def transcribe(self, audio_path: str, language: str = "en") -> str:
        """
        Transcribe audio file to text.

        Args:
            audio_path: Path to audio file
            language: Language code (default: en)

        Returns:
            Transcribed text
        """
        if not self.model:
            raise RuntimeError("Model not loaded")

        try:
            logger.info(f"Transcribing {audio_path}...")
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                task="transcribe"
            )

            # Combine all segments into single text
            text = " ".join([segment.text for segment in segments])
            logger.info(f"Transcription complete: {text[:100]}...")
            return text
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
