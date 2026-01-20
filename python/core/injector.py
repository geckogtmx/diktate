"""Text injector module using pynput and pyperclip."""

from pynput.keyboard import Controller, Key
import logging
import time
import pyperclip
from typing import Optional

logger = logging.getLogger(__name__)


class Injector:
    """Injects text into active application using clipboard paste."""

    def __init__(self):
        """Initialize the injector."""
        self.keyboard = Controller()

    def type_text(self, text: str, delay: Optional[float] = None) -> None:
        """
        Legacy method for backward compatibility. 
        Forwards to paste_text for better performance.
        """
        self.paste_text(text)

    def paste_text(self, text: str) -> None:
        """
        Inject text using clipboard paste (Ctrl+V).
        
        Preserves the user's original clipboard content.
        
        Args:
            text: Text to paste
        """
        try:
            logger.info(f"Pasting {len(text)} characters...")
            
            # 1. Save original clipboard
            try:
                original_clipboard = pyperclip.paste()
            except Exception:
                original_clipboard = ""

            # 2. Copy new text to clipboard
            pyperclip.copy(text)
            
            # 3. Simulate Ctrl+V
            # Small delay to ensure clipboard is ready
            time.sleep(0.05)
            
            with self.keyboard.pressed(Key.ctrl):
                self.keyboard.press('v')
                self.keyboard.release('v')
                
            # 4. Wait for paste to complete before restoring clipboard
            # Reduced from 100ms to 20ms (M2 security fix - minimize clipboard exposure)
            time.sleep(0.02) 
            
            # 5. Restore original clipboard
            # Note: Some apps might be slow to paste, so this restores 
            # might technically happen "too fast" for extremely laggy apps,
            # but 100ms is usually safe for modern OS.
            if original_clipboard:
                pyperclip.copy(original_clipboard)
                
            logger.info("Text pasted successfully")
            
        except Exception as e:
            logger.error(f"Error pasting text: {e}")
            # Fallback to typing if paste fails?
            # self._type_fallback(text)
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
