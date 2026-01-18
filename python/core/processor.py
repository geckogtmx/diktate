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


from config.prompts import get_prompt, DEFAULT_CLEANUP_PROMPT

class LocalProcessor:
    """Processes transcribed text using local Ollama LLM."""

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model: str = "gemma3:4b",
        mode: str = "standard"
    ):
        self.ollama_url = ollama_url
        self.model = model
        self.mode = mode
        self.prompt = get_prompt(mode, model)
        self._verify_ollama()

    def set_mode(self, mode: str) -> None:
        """Update processing mode (standard, professional, literal)."""
        self.mode = mode
        self.prompt = get_prompt(mode, self.model)
        logger.info(f"Processor mode switched to: {mode}")

    def _verify_ollama(self) -> None:
        """Verify Ollama server is running and warm up the model."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                logger.info("Ollama server is running")
            else:
                raise ConnectionError(f"Ollama returned status {response.status_code}")
        except requests.ConnectionError as e:
            logger.error(f"Cannot connect to Ollama at {self.ollama_url}: {e}")
            raise

        # Warm up the model by loading it into memory
        try:
            logger.info(f"Warming up {self.model}...")
            requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": "",
                    "stream": False,
                    "options": {"num_ctx": 2048, "num_predict": 1},
                    "keep_alive": "10m"
                },
                timeout=30
            )
            logger.info(f"Model {self.model} ready")
        except Exception as e:
            logger.warning(f"Model warmup failed (will retry on first use): {e}")

    def process(self, text: str, max_retries: int = 3) -> str:
        """Process text using Ollama."""
        prompt = self.prompt.replace("{text}", text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with {self.model} (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "num_ctx": 2048  # Small context to save VRAM
                        },
                        "keep_alive": "10m"  # Keep model loaded
                    },
                    timeout=20  # Fail fast
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
        self.mode = "standard"
        logger.info("Cloud processor initialized (Gemini Flash)")

    def set_mode(self, mode: str) -> None:
        """Update processing mode (standard, prompt, professional, raw)."""
        self.mode = mode
        self.prompt = get_prompt(mode)
        logger.info(f"Cloud processor mode switched to: {mode}")

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


class AnthropicProcessor:
    """Processes transcribed text using Anthropic Claude API."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment")
        self.prompt = prompt or DEFAULT_CLEANUP_PROMPT
        self.api_url = "https://api.anthropic.com/v1/messages"
        self.model = "claude-3-haiku-20240307"  # Fastest Claude model
        self.mode = "standard"
        logger.info(f"Anthropic processor initialized (Claude 3.5 Haiku)")

    def set_mode(self, mode: str) -> None:
        """Update processing mode (standard, prompt, professional, raw)."""
        self.mode = mode
        self.prompt = get_prompt(mode)
        logger.info(f"Anthropic processor mode switched to: {mode}")

    def process(self, text: str, max_retries: int = 3) -> str:
        """Process text using Anthropic Claude API."""
        prompt = self.prompt.replace("{text}", text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with Claude Haiku (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    self.api_url,
                    json={
                        "model": self.model,
                        "max_tokens": 1024,
                        "messages": [{"role": "user", "content": prompt}]
                    },
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01"
                    },
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    # Extract text from Claude response structure
                    content = result.get("content", [])
                    if content:
                        processed_text = content[0].get("text", "").strip()
                        logger.info("Text processed successfully (Claude)")
                        return processed_text
                    logger.warning("Empty response from Claude API")
                else:
                    logger.warning(f"Claude API returned status {response.status_code}: {response.text}")

            except requests.Timeout:
                logger.warning(f"Claude API request timed out (attempt {attempt + 1}/{max_retries})")
            except requests.ConnectionError as e:
                logger.warning(f"Connection error to Claude API (attempt {attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"Error processing text with Claude: {e}")

        logger.error(f"Failed to process text after {max_retries} retries")
        return text


class OpenAIProcessor:
    """Processes transcribed text using OpenAI API."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")
        self.prompt = prompt or DEFAULT_CLEANUP_PROMPT
        self.api_url = "https://api.openai.com/v1/chat/completions"
        self.model = "gpt-4o-mini"  # Fast and cheap
        self.mode = "standard"
        logger.info(f"OpenAI processor initialized (GPT-4o-mini)")

    def set_mode(self, mode: str) -> None:
        """Update processing mode (standard, prompt, professional, raw)."""
        self.mode = mode
        self.prompt = get_prompt(mode)
        logger.info(f"OpenAI processor mode switched to: {mode}")

    def process(self, text: str, max_retries: int = 3) -> str:
        """Process text using OpenAI API."""
        prompt = self.prompt.replace("{text}", text)

        for attempt in range(max_retries):
            try:
                logger.info(f"Processing text with GPT-4o-mini (attempt {attempt + 1}/{max_retries})...")
                response = requests.post(
                    self.api_url,
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1024,
                        "temperature": 0.1
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.api_key}"
                    },
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    # Extract text from OpenAI response structure
                    choices = result.get("choices", [])
                    if choices:
                        processed_text = choices[0].get("message", {}).get("content", "").strip()
                        logger.info("Text processed successfully (OpenAI)")
                        return processed_text
                    logger.warning("Empty response from OpenAI API")
                else:
                    logger.warning(f"OpenAI API returned status {response.status_code}: {response.text}")

            except requests.Timeout:
                logger.warning(f"OpenAI API request timed out (attempt {attempt + 1}/{max_retries})")
            except requests.ConnectionError as e:
                logger.warning(f"Connection error to OpenAI API (attempt {attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"Error processing text with OpenAI: {e}")

        logger.error(f"Failed to process text after {max_retries} retries")
        return text


# Factory function to create the right processor based on environment
def create_processor():
    """Create processor based on PROCESSING_MODE env var."""
    mode = os.environ.get("PROCESSING_MODE", "local").lower()
    
    if mode == "gemini" or mode == "cloud":
        logger.info("Using GEMINI processing mode (Gemini Flash)")
        return CloudProcessor()
    elif mode == "anthropic":
        logger.info("Using ANTHROPIC processing mode (Claude Haiku)")
        return AnthropicProcessor()
    elif mode == "openai":
        logger.info("Using OPENAI processing mode (GPT-4o-mini)")
        return OpenAIProcessor()
    else:
        logger.info("Using LOCAL processing mode (Ollama)")
        return LocalProcessor()


# Backward compatibility alias
Processor = LocalProcessor
