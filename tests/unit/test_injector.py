"""
Unit tests for core/injector.py

Tests the Injector class for clipboard manipulation and keyboard simulation.
"""

import time
import unittest
from unittest.mock import Mock, patch, call, MagicMock

import pytest
from pynput.keyboard import Key

from core.injector import Injector


class TestInjectorInit(unittest.TestCase):
    """Test Injector initialization."""

    def test_init_creates_keyboard_controller(self):
        """__init__ should create keyboard controller"""
        injector = Injector()

        assert injector.keyboard is not None
        assert injector.add_trailing_space is True  # Default enabled


class TestPasteText(unittest.TestCase):
    """Test paste_text method (clipboard save/restore)."""

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_saves_and_restores_clipboard(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should save original clipboard and restore it after pasting"""
        mock_paste.return_value = "original clipboard content"

        injector = Injector()

        # Mock keyboard controller
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()

        injector.paste_text("new text")

        # Verify clipboard save/paste/restore sequence
        assert mock_copy.call_count == 2
        # First call: copy new text (with trailing space)
        mock_copy.assert_any_call("new text ")
        # Second call: restore original clipboard
        mock_copy.assert_any_call("original clipboard content")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_adds_trailing_space_when_enabled(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should add trailing space when add_trailing_space=True"""
        mock_paste.return_value = "original"

        injector = Injector()
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()
        injector.add_trailing_space = True

        injector.paste_text("hello")

        # Verify trailing space was added
        mock_copy.assert_any_call("hello ")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_no_trailing_space_when_disabled(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should not add trailing space when add_trailing_space=False"""
        mock_paste.return_value = "original"

        injector = Injector()
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()
        injector.add_trailing_space = False

        injector.paste_text("hello")

        # Verify no trailing space
        mock_copy.assert_any_call("hello")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_handles_empty_original_clipboard(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should handle empty original clipboard"""
        mock_paste.return_value = ""

        injector = Injector()
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()

        injector.paste_text("new text")

        # Should still copy new text, but not restore empty clipboard
        assert mock_copy.call_count == 1  # Only copy new text
        mock_copy.assert_called_with("new text ")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_handles_clipboard_read_exception(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should handle clipboard read failure gracefully"""
        mock_paste.side_effect = Exception("Clipboard access denied")

        injector = Injector()
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()

        # Should not crash, should use empty string as original
        injector.paste_text("new text")

        # Should still paste new text
        mock_copy.assert_called_with("new text ")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_paste_simulates_ctrl_v(self, mock_sleep, mock_copy, mock_paste):
        """paste_text should simulate Ctrl+V using keyboard controller"""
        mock_paste.return_value = "original"

        injector = Injector()
        mock_keyboard = Mock()
        mock_keyboard.pressed = MagicMock()
        injector.keyboard = mock_keyboard

        injector.paste_text("test text")

        # Verify Ctrl was pressed
        mock_keyboard.pressed.assert_called_once_with(Key.ctrl)
        # Verify 'v' was pressed and released
        mock_keyboard.press.assert_called_once_with("v")
        mock_keyboard.release.assert_called_once_with("v")


class TestPressKey(unittest.TestCase):
    """Test press_key method (single key mapping)."""

    @patch("time.sleep")
    def test_press_key_maps_enter(self, mock_sleep):
        """press_key should map 'enter' to Key.enter"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_key("enter")

        injector.keyboard.press.assert_called_once_with(Key.enter)
        injector.keyboard.release.assert_called_once_with(Key.enter)

    @patch("time.sleep")
    def test_press_key_maps_return_to_enter(self, mock_sleep):
        """press_key should map 'return' to Key.enter (alias)"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_key("return")

        injector.keyboard.press.assert_called_once_with(Key.enter)

    @patch("time.sleep")
    def test_press_key_maps_tab(self, mock_sleep):
        """press_key should map 'tab' to Key.tab"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_key("tab")

        injector.keyboard.press.assert_called_once_with(Key.tab)
        injector.keyboard.release.assert_called_once_with(Key.tab)

    @patch("time.sleep")
    def test_press_key_handles_unknown_key(self, mock_sleep):
        """press_key should handle unknown key name gracefully"""
        injector = Injector()
        injector.keyboard = Mock()

        # Should not raise exception
        injector.press_key("unknown_key")

        # Should not press any key
        injector.keyboard.press.assert_not_called()
        injector.keyboard.release.assert_not_called()

    @patch("time.sleep")
    def test_press_key_case_insensitive(self, mock_sleep):
        """press_key should handle uppercase key names"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_key("ENTER")

        injector.keyboard.press.assert_called_once_with(Key.enter)


class TestCaptureSelection(unittest.TestCase):
    """Test capture_selection method (clipboard change detection)."""

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_detects_clipboard_change(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should detect and return changed clipboard content"""
        # Simulate clipboard change after Ctrl+C
        mock_paste.side_effect = ["original", "original", "selected text", "selected text"]

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=1500)

        assert result == "selected text"
        # Verify original clipboard was restored
        mock_copy.assert_called_with("original")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_returns_none_on_timeout(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should return None if clipboard doesn't change"""
        # Clipboard never changes
        mock_paste.return_value = "original"

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=100)

        assert result is None
        # Should not restore clipboard if it never changed
        mock_copy.assert_not_called()

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_returns_none_on_empty_selection(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should return None if clipboard changes to empty"""
        # Clipboard changes but is empty/whitespace
        mock_paste.side_effect = ["original", "original", "  ", "  "]

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=1500)

        assert result is None
        # Verify original clipboard was restored even on empty capture
        mock_copy.assert_called_with("original")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_restores_original_on_success(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should restore original clipboard after successful capture"""
        mock_paste.side_effect = ["saved original", "saved original", "captured text"]

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=1500)

        assert result == "captured text"
        # Verify original was restored
        mock_copy.assert_called_with("saved original")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_clears_clipboard_if_original_empty(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should clear clipboard if original was empty"""
        # Original clipboard is empty, captures text, then restores to empty
        mock_paste.side_effect = ["", "", "captured text"]

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=1500)

        assert result == "captured text"
        # Verify clipboard was cleared (restored to empty)
        mock_copy.assert_called_with("")

    @patch("pyperclip.paste")
    @patch("time.sleep")
    def test_capture_selection_sends_ctrl_c(self, mock_sleep, mock_paste):
        """capture_selection should send Ctrl+C to trigger copy"""
        mock_paste.return_value = "test"

        injector = Injector()
        injector.keyboard = Mock()

        # Mock press_keys to avoid recursion
        with patch.object(injector, "press_keys") as mock_press_keys:
            injector.capture_selection(timeout_ms=100)

            # Verify Ctrl+C was sent
            mock_press_keys.assert_called_once_with(Key.ctrl, "c")

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_capture_selection_handles_clipboard_read_error(self, mock_sleep, mock_copy, mock_paste):
        """capture_selection should return None if clipboard read fails"""
        mock_paste.side_effect = Exception("Clipboard access denied")

        injector = Injector()
        injector.keyboard = Mock()

        result = injector.capture_selection(timeout_ms=100)

        assert result is None


class TestPressKeys(unittest.TestCase):
    """Test press_keys method (multiple keys, press/release ordering)."""

    @patch("time.sleep")
    def test_press_keys_forward_press_order(self, mock_sleep):
        """press_keys should press keys in forward order"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_keys(Key.ctrl, Key.shift, "a")

        # Verify forward order: Ctrl, Shift, 'a'
        assert injector.keyboard.press.call_count == 3
        calls = injector.keyboard.press.call_args_list
        assert calls[0] == call(Key.ctrl)
        assert calls[1] == call(Key.shift)
        assert calls[2] == call("a")

    @patch("time.sleep")
    def test_press_keys_reverse_release_order(self, mock_sleep):
        """press_keys should release keys in reverse order"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_keys(Key.ctrl, Key.shift, "a")

        # Verify reverse order: 'a', Shift, Ctrl
        assert injector.keyboard.release.call_count == 3
        calls = injector.keyboard.release.call_args_list
        assert calls[0] == call("a")
        assert calls[1] == call(Key.shift)
        assert calls[2] == call(Key.ctrl)

    @patch("time.sleep")
    def test_press_keys_single_key(self, mock_sleep):
        """press_keys should handle single key"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_keys("x")

        injector.keyboard.press.assert_called_once_with("x")
        injector.keyboard.release.assert_called_once_with("x")

    @patch("time.sleep")
    def test_press_keys_ctrl_c_combination(self, mock_sleep):
        """press_keys should handle Ctrl+C combination"""
        injector = Injector()
        injector.keyboard = Mock()

        injector.press_keys(Key.ctrl, "c")

        # Verify press order: Ctrl then C
        press_calls = injector.keyboard.press.call_args_list
        assert press_calls[0] == call(Key.ctrl)
        assert press_calls[1] == call("c")

        # Verify release order: C then Ctrl (reversed)
        release_calls = injector.keyboard.release.call_args_list
        assert release_calls[0] == call("c")
        assert release_calls[1] == call(Key.ctrl)


class TestTypeText(unittest.TestCase):
    """Test type_text method (legacy compatibility)."""

    @patch("pyperclip.paste")
    @patch("pyperclip.copy")
    @patch("time.sleep")
    def test_type_text_forwards_to_paste_text(self, mock_sleep, mock_copy, mock_paste):
        """type_text should forward to paste_text for backward compatibility"""
        mock_paste.return_value = "original"

        injector = Injector()
        injector.keyboard = Mock()
        injector.keyboard.pressed = MagicMock()

        # Mock paste_text to verify it's called
        with patch.object(injector, "paste_text") as mock_paste_text:
            injector.type_text("test text")

            mock_paste_text.assert_called_once_with("test text")


if __name__ == "__main__":
    unittest.main()
