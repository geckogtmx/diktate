"""Text processor module with support for local (Ollama) and cloud (Gemini) modes."""

import os
import requests
import logging
from typing import Optional
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

logger = logging.getLogger(__name__)


# Default cleanup prompt - same for both local and cloud
DEFAULT_CLEANUP_PROMPT = """You are a text cleanup tool. Your ONLY job is to output the cleaned text. Do NOT add any commentary, explanations, or phrases like "Here's the cleaned text".

Rules:
1. Remove filler words (um, uh, like, you know) only if they are used as hesitations.
2. Fix punctuation and capitalization.
3. PRESERVE colloquialisms, slang, and emphasis (e.g., "freaking", "gonna", "wanna").
4. DO NOT change the tone or vocabulary.
5. If the input is short or unclear, return it exactly as is (with punctuation).
6. Return ONLY the cleaned text with NO preamble, NO explanation, NO commentary.

Input: {text}

Cleaned text:"""


class LocalProcessor:
    """Processes transcribed text using local Ollama LLM."""

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model: str = "llama3:latest",
        prompt: Optional[str] = None
    ):
        self.ollama_url = ollama_url
        self.model = model
        self.prompt = prompt or DEFAULT_CLEANUP_PROMPT
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
        """Process text using Ollama."""
        prompt = self.prompt.replace("{text}", text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with Ollama (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "temperature": 0.1
                    },
                    timeout=60
                )

                if response.status_code == 200:
                    result = response.json()
                    processed_text = result.get("response", "").strip()
                    logger.info("Text processed successfully")
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
        return text


class CloudProcessor:
    """Processes transcribed text using Gemini API (cloud)."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")
        self.prompt = prompt or DEFAULT_CLEANUP_PROMPT
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"
        logger.info("Cloud processor initialized (Gemini Flash)")

    def process(self, text: str, max_retries: int = 3) -> str:
        """Process text using Gemini API."""
        prompt = self.prompt.replace("{text}", text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with Gemini Flash (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    f"{self.api_url}?key={self.api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 1024
                        }
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    # Extract text from Gemini response structure
                    candidates = result.get("candidates", [])
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        if parts:
                            processed_text = parts[0].get("text", "").strip()
                            logger.info("Text processed successfully (cloud)")
                            return processed_text
                    logger.warning("Empty response from Gemini API")
                else:
                    logger.warning(f"Gemini API returned status {response.status_code}: {response.text}")

            except requests.Timeout:
                logger.warning(f"Gemini API request timed out (attempt {attempt + 1}/{max_retries})")
            except requests.ConnectionError as e:
                logger.warning(f"Connection error to Gemini API (attempt {attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"Error processing text with Gemini: {e}")

        logger.error(f"Failed to process text after {max_retries} retries")
        return text


# Factory function to create the right processor based on environment
def create_processor() -> LocalProcessor | CloudProcessor:
    """Create processor based on PROCESSING_MODE env var."""
    mode = os.environ.get("PROCESSING_MODE", "local").lower()
    
    if mode == "cloud":
        logger.info("Using CLOUD processing mode (Gemini Flash)")
        return CloudProcessor()
    else:
        logger.info("Using LOCAL processing mode (Ollama)")
        return LocalProcessor()


# Backward compatibility alias
Processor = LocalProcessor
