"""Text processor module with support for local (Ollama) and cloud (Gemini) modes."""

import os
import re
import requests
import logging
import time
from typing import Optional
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

logger = logging.getLogger(__name__)


from config.prompts import get_prompt, DEFAULT_CLEANUP_PROMPT


def validate_api_key(provider: str, api_key: str) -> None:
    """Validate API key format for a given provider (SPEC_013).

    Args:
        provider: Provider name ('gemini', 'anthropic', 'openai')
        api_key: The API key to validate

    Raises:
        ValueError: If the API key format is invalid for the given provider
    """
    patterns = {
        'gemini': (r'^AIza[0-9A-Za-z-_]{35}$', 'AIza followed by 35 characters'),
        'anthropic': (r'^sk-ant-[a-zA-Z0-9\-_]{20,}$', 'sk-ant- followed by 20+ characters'),
        'openai': (r'^sk-[a-zA-Z0-9]{20,}$', 'sk- followed by 20+ alphanumeric characters')
    }

    if provider not in patterns:
        return  # Unknown provider, skip validation

    pattern, description = patterns[provider]
    if not re.match(pattern, api_key):
        raise ValueError(
            f"Invalid {provider} API key format. "
            f"Expected: {description}. "
            f"Please check your API key and try again."
        )

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

    def set_model(self, model: str) -> None:
        """Hot-swap the Ollama model without recreating the processor."""
        if model == self.model:
            logger.info(f"Model already set to {model}, skipping")
            return

        old_model = self.model
        self.model = model
        self.prompt = get_prompt(self.mode, model)
        logger.info(f"Processor model switched from {old_model} to {model}")

        # Warm up the new model
        try:
            logger.info(f"Warming up {model}...")
            requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": "",
                    "stream": False,
                    "options": {"num_ctx": 2048, "num_predict": 1},
                    "keep_alive": "10m"
                },
                timeout=30
            )
            logger.info(f"Model {model} ready")
        except Exception as e:
            logger.warning(f"Model warmup failed (will retry on first use): {e}")

    def set_custom_prompt(self, custom_prompt: str) -> None:
        """Set a custom system prompt (overrides mode defaults).

        Args:
            custom_prompt: The custom prompt template (must include {text} placeholder)
        """
        if not custom_prompt:
            logger.warning("Attempted to set empty custom prompt, ignoring")
            return

        if "{text}" not in custom_prompt:
            logger.error("Custom prompt missing {text} placeholder, ignoring")
            return

        self.prompt = custom_prompt
        logger.info(f"Custom prompt set for {self.mode} mode ({len(custom_prompt)} chars)")
        logger.debug(f"Custom prompt preview: {custom_prompt[:100]}...")


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

    def _sanitize_for_prompt(self, text: str) -> str:
        """Sanitize input text to prevent prompt injection (M1 security fix)."""
        # Escape code block delimiters that could break prompt structure
        text = text.replace("```", "'''")
        # Prevent template injection
        text = text.replace("{text}", "[text]")
        return text

    def process(self, text: str, max_retries: int = 3, prompt_override: Optional[str] = None) -> str:
        """Process text using Ollama with exponential backoff retry logic.

        Args:
            text: The text to process
            max_retries: Number of retry attempts on failure
            prompt_override: Optional custom prompt to use instead of self.prompt
                           (for one-off processing without changing mode)
        """
        # Sanitize input to prevent prompt injection (M1 security fix)
        safe_text = self._sanitize_for_prompt(text)
        # Use override if provided, otherwise use the instance prompt
        active_prompt = prompt_override if prompt_override is not None else self.prompt
        prompt = active_prompt.replace("{text}", safe_text)

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

            # Exponential backoff: 1s, 2s, 4s (only if not the last attempt)
            if attempt < max_retries - 1:
                backoff_delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"Retrying in {backoff_delay}s...")
                time.sleep(backoff_delay)

        logger.error(f"Failed to process text after {max_retries} retries")
        raise Exception(f"Ollama processing failed after {max_retries} retries")


class CloudProcessor:
    """Processes transcribed text using Gemini API (cloud)."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        # SPEC_013: Validate key format
        validate_api_key('gemini', self.api_key)

        self.prompt = prompt or DEFAULT_CLEANUP_PROMPT
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"
        self.mode = "standard"
        logger.info("Cloud processor initialized (Gemini Flash)")

    def set_mode(self, mode: str) -> None:
        """Update processing mode (standard, prompt, professional, raw)."""
        self.mode = mode
        self.prompt = get_prompt(mode)
        logger.info(f"Cloud processor mode switched to: {mode}")

    def set_custom_prompt(self, custom_prompt: str) -> None:
        """Set a custom system prompt (overrides mode defaults)."""
        if not custom_prompt:
            logger.warning("Attempted to set empty custom prompt, ignoring")
            return
        if "{text}" not in custom_prompt:
            logger.error("Custom prompt missing {text} placeholder, ignoring")
            return
        self.prompt = custom_prompt
        logger.info(f"Custom prompt set for cloud processor ({len(custom_prompt)} chars)")

    def _sanitize_for_prompt(self, text: str) -> str:
        """Sanitize input text to prevent prompt injection (M1 security fix)."""
        text = text.replace("```", "'''")
        text = text.replace("{text}", "[text]")
        return text

    def process(self, text: str, max_retries: int = 3, prompt_override: Optional[str] = None) -> str:
        """Process text using Gemini API with exponential backoff retry logic.

        Args:
            text: The text to process
            max_retries: Number of retry attempts on failure
            prompt_override: Optional custom prompt to use instead of self.prompt
        """
        safe_text = self._sanitize_for_prompt(text)
        active_prompt = prompt_override if prompt_override is not None else self.prompt
        prompt = active_prompt.replace("{text}", safe_text)

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

            # Exponential backoff: 1s, 2s, 4s (only if not the last attempt)
            if attempt < max_retries - 1:
                backoff_delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"Retrying in {backoff_delay}s...")
                time.sleep(backoff_delay)

        logger.error(f"Failed to process text after {max_retries} retries")
        raise Exception(f"Gemini API processing failed after {max_retries} retries")


class AnthropicProcessor:
    """Processes transcribed text using Anthropic Claude API."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment")

        # SPEC_013: Validate key format
        validate_api_key('anthropic', self.api_key)

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

    def set_custom_prompt(self, custom_prompt: str) -> None:
        """Set a custom system prompt (overrides mode defaults)."""
        if not custom_prompt:
            logger.warning("Attempted to set empty custom prompt, ignoring")
            return
        if "{text}" not in custom_prompt:
            logger.error("Custom prompt missing {text} placeholder, ignoring")
            return
        self.prompt = custom_prompt
        logger.info(f"Custom prompt set for Anthropic processor ({len(custom_prompt)} chars)")

    def _sanitize_for_prompt(self, text: str) -> str:
        """Sanitize input text to prevent prompt injection (M1 security fix)."""
        text = text.replace("```", "'''")
        text = text.replace("{text}", "[text]")
        return text

    def process(self, text: str, max_retries: int = 3, prompt_override: Optional[str] = None) -> str:
        """Process text using Anthropic Claude API.

        Args:
            text: The text to process
            max_retries: Number of retry attempts on failure
            prompt_override: Optional custom prompt to use instead of self.prompt
        """
        safe_text = self._sanitize_for_prompt(text)
        active_prompt = prompt_override if prompt_override is not None else self.prompt
        prompt = active_prompt.replace("{text}", safe_text)

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

            # Exponential backoff: 1s, 2s, 4s (only if not the last attempt)
            if attempt < max_retries - 1:
                backoff_delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"Retrying in {backoff_delay}s...")
                time.sleep(backoff_delay)

        logger.error(f"Failed to process text after {max_retries} retries")
        raise Exception(f"Claude API processing failed after {max_retries} retries")


class OpenAIProcessor:
    """Processes transcribed text using OpenAI API."""

    def __init__(self, api_key: Optional[str] = None, prompt: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")

        # SPEC_013: Validate key format
        validate_api_key('openai', self.api_key)

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

    def _sanitize_for_prompt(self, text: str) -> str:
        """Sanitize input text to prevent prompt injection (M1 security fix)."""
        text = text.replace("```", "'''")
        text = text.replace("{text}", "[text]")
        return text

    def process(self, text: str, max_retries: int = 3, prompt_override: Optional[str] = None) -> str:
        """Process text using OpenAI API.

        Args:
            text: The text to process
            max_retries: Number of retry attempts on failure
            prompt_override: Optional custom prompt to use instead of self.prompt
        """
        safe_text = self._sanitize_for_prompt(text)
        active_prompt = prompt_override if prompt_override is not None else self.prompt
        prompt = active_prompt.replace("{text}", safe_text)

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

            # Exponential backoff: 1s, 2s, 4s (only if not the last attempt)
            if attempt < max_retries - 1:
                backoff_delay = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"Retrying in {backoff_delay}s...")
                time.sleep(backoff_delay)

        logger.error(f"Failed to process text after {max_retries} retries")
        raise Exception(f"OpenAI API processing failed after {max_retries} retries")


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
