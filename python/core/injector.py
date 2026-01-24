"""Text injector module using pynput and pyperclip."""

from pynput.keyboard import Controller, Key
import logging
import time
import pyperclip
from typing import Optional
import ctypes
import platform

logger = logging.getLogger(__name__)

# Windows-specific keyboard codes and SendInput structures
if platform.system() == 'Windows':
    from ctypes import Structure, c_uint, c_ushort

    # Virtual key codes
    VK_CONTROL = 0x11
    VK_C = 0x43

    # SendInput event flags
    KEYEVENTF_KEYDOWN = 0x0000
    KEYEVENTF_KEYUP = 0x0002
    INPUT_KEYBOARD = 1

    class KEYBDINPUT(Structure):
        _fields_ = [
            ("wVk", c_ushort),
            ("wScan", c_ushort),
            ("dwFlags", c_uint),
            ("time", c_uint),
            ("dwExtraInfo", c_uint),
        ]

    class INPUT(Structure):
        _fields_ = [
            ("type", c_uint),
            ("ki", KEYBDINPUT),
        ]

    def send_keystroke_to_active_window(vk_code: int):
        """Send a virtual key to the active window using Windows API SendInput."""
        try:
            user32 = ctypes.windll.user32

            # Create INPUT structure for key down
            input_down = INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(wVk=vk_code, dwFlags=KEYEVENTF_KEYDOWN))
            input_array = (INPUT * 1)(input_down)
            user32.SendInput(1, ctypes.byref(input_array), ctypes.sizeof(INPUT))

            time.sleep(0.01)

            # Create INPUT structure for key up
            input_up = INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(wVk=vk_code, dwFlags=KEYEVENTF_KEYUP))
            input_array = (INPUT * 1)(input_up)
            user32.SendInput(1, ctypes.byref(input_array), ctypes.sizeof(INPUT))
        except Exception as e:
            logger.debug(f"Windows API keystroke failed (will fallback): {e}")


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

    def capture_selection(self, timeout_ms: int = 1500) -> Optional[str]:
        """
        Capture currently selected text via clipboard.

        Algorithm:
        1. Wait for focus to return to active window after hotkey
        2. Save current clipboard content
        3. Trigger Ctrl+C to copy selection
        4. Poll clipboard every 10ms until content changes or timeout
        5. Return captured text or None if no selection

        Args:
            timeout_ms: Maximum wait time for clipboard change (default: 1500ms)

        Returns:
            Captured text if successful, None if no selection or timeout
        """
        try:
            # CRITICAL: Wait for focus to return to the previously focused window
            # Global hotkeys can steal focus temporarily
            # Extended to 1 second to ensure focus is stable before sending keys
            logger.info("[CAPTURE] Waiting for focus to settle...")
            time.sleep(1.0)

            # 1. Cache current clipboard
            try:
                original_clipboard = pyperclip.paste()
                logger.debug(f"[CAPTURE] Original clipboard: {len(original_clipboard)} chars")
            except Exception as e:
                logger.error(f"[CAPTURE] Failed to read clipboard: {e}")
                return None

            # 2. Trigger copy command (Ctrl+C) using keyboard simulation
            logger.info("[CAPTURE] Sending Ctrl+C...")
            try:
                # Use pynput keyboard controller - it's reliable across platforms
                self.press_keys(Key.ctrl, 'c')
                logger.debug("[CAPTURE] Ctrl+C sent successfully")
            except Exception as e:
                logger.error(f"[CAPTURE] Failed to send Ctrl+C: {e}")
                return None

            # Wait for clipboard to update after Ctrl+C
            # Most apps copy within 100-200ms
            logger.debug("[CAPTURE] Waiting for clipboard update...")
            time.sleep(0.1)

            # 3. Poll for clipboard change
            start_time = time.time()
            poll_interval = 0.01  # 10ms
            max_wait = timeout_ms / 1000.0
            polls = 0

            while (time.time() - start_time) < max_wait:
                polls += 1
                try:
                    current_clipboard = pyperclip.paste()

                    # Success: Clipboard changed
                    if current_clipboard != original_clipboard:
                        # Validate: Not empty
                        if current_clipboard and current_clipboard.strip():
                            elapsed_ms = (time.time() - start_time) * 1000
                            logger.info(f"[CAPTURE] Captured {len(current_clipboard)} chars in {elapsed_ms:.0f}ms")

                            # ✅ FIX: Restore original clipboard before returning
                            # This ensures paste_text() receives the user's real clipboard, not the selected text
                            try:
                                if original_clipboard:
                                    pyperclip.copy(original_clipboard)
                                    logger.debug(f"[CAPTURE] Restored original clipboard ({len(original_clipboard)} chars)")
                                else:
                                    # If original was empty, clear clipboard
                                    pyperclip.copy("")
                                    logger.debug("[CAPTURE] Cleared clipboard (original was empty)")
                            except Exception as e:
                                logger.warning(f"[CAPTURE] Failed to restore clipboard: {e}")
                                # Non-fatal - continue with return

                            return current_clipboard
                        else:
                            logger.warning("[CAPTURE] Clipboard changed but content is empty")

                            # ✅ FIX: Restore original clipboard on empty capture
                            try:
                                if original_clipboard:
                                    pyperclip.copy(original_clipboard)
                                    logger.debug("[CAPTURE] Restored original clipboard (empty capture)")
                                else:
                                    pyperclip.copy("")
                            except Exception as e:
                                logger.warning(f"[CAPTURE] Failed to restore clipboard after empty capture: {e}")

                            return None

                    time.sleep(poll_interval)

                except Exception as e:
                    logger.error(f"[CAPTURE] Error polling clipboard: {e}")
                    time.sleep(poll_interval)

            # 4. Timeout - no selection detected
            logger.warning(f"[CAPTURE] Timeout after {timeout_ms}ms ({polls} polls) - no selection detected")
            logger.debug(f"[CAPTURE] Current clipboard length: {len(current_clipboard)}")

            # ✅ FIX: Clipboard is already in original state if no change detected
            # No restoration needed - if clipboard never changed, it's in the original state
            return None

        except Exception as e:
            logger.error(f"[CAPTURE] Unexpected error: {e}")
            return None

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
