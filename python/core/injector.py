"""Text injector module using pynput."""

from pynput.keyboard import Controller, Key
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class Injector:
    """Injects text into active application using keyboard simulation."""

    def __init__(self, delay_per_char: float = 0.01):
        """
        Initialize the injector.

        Args:
            delay_per_char: Delay between characters in seconds
        """
        self.keyboard = Controller()
        self.delay_per_char = delay_per_char

    def type_text(self, text: str, delay: Optional[float] = None) -> None:
        """
        Type text character by character.

        Args:
            text: Text to type
            delay: Optional custom delay per character
        """
        char_delay = delay or self.delay_per_char

        try:
            logger.info(f"Typing {len(text)} characters...")
            for char in text:
                self.keyboard.type(char)
                time.sleep(char_delay)
            logger.info("Text typed successfully")
        except Exception as e:
            logger.error(f"Error typing text: {e}")
            raise

    def press_keys(self, *keys) -> None:
        """
        Press multiple keys simultaneously.

        Args:
            *keys: Keys to press (e.g., Key.ctrl, Key.shift, 'a')
        """
        try:
            for key in keys:
                self.keyboard.press(key)
            time.sleep(0.1)
            for key in reversed(keys):
                self.keyboard.release(key)
            logger.info(f"Keys pressed: {keys}")
        except Exception as e:
            logger.error(f"Error pressing keys: {e}")
            raise
