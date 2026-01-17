"""Text processor module using Ollama."""

import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class Processor:
    """Processes transcribed text using Ollama LLM."""

    # Default cleanup prompt for standard mode
    DEFAULT_CLEANUP_PROMPT = """You are a professional text editor. Your task is to clean up transcribed text.

Rules:
1. Remove filler words (um, uh, like, you know, basically, actually)
2. Fix grammar and punctuation
3. Capitalize properly
4. Maintain the original meaning
5. Keep the text concise
6. Do NOT add anything that wasn't in the original text
7. Return ONLY the cleaned text, no explanations

Transcribed text: {text}

Cleaned text:"""

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model: str = "mistral:latest",
        prompt: Optional[str] = None
    ):
        """
        Initialize the text processor.

        Args:
            ollama_url: URL of Ollama server
            model: Model name (default: llama3:8b)
            prompt: Custom prompt (uses default if not provided)
        """
        self.ollama_url = ollama_url
        self.model = model
        self.prompt = prompt or self.DEFAULT_CLEANUP_PROMPT
        self._verify_ollama()

    def _verify_ollama(self) -> None:
        """Verify Ollama server is running."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                logger.info("Ollama server is running")
            else:
                raise ConnectionError(f"Ollama returned status {response.status_code}")
        except requests.ConnectionError as e:
            logger.error(f"Cannot connect to Ollama at {self.ollama_url}: {e}")
            raise

    def process(self, text: str, max_retries: int = 3) -> str:
        """
        Process text using Ollama.

        Args:
            text: Raw transcribed text
            max_retries: Number of retries on failure

        Returns:
            Processed text
        """
        prompt = self.prompt.format(text=text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with Ollama (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "temperature": 0.3  # Lower temperature for more consistent results
                    },
                    timeout=60
                )

                if response.status_code == 200:
                    result = response.json()
                    processed_text = result.get("response", "").strip()
                    logger.info(f"Text processed successfully")
                    return processed_text
                else:
                    logger.warning(f"Ollama returned status {response.status_code}")

            except requests.Timeout:
                logger.warning(f"Ollama request timed out (attempt {attempt + 1}/{max_retries})")
            except requests.ConnectionError as e:
                logger.warning(f"Connection error to Ollama (attempt {attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"Error processing text: {e}")

        logger.error(f"Failed to process text after {max_retries} retries")
        # Return original text if processing fails
        return text
