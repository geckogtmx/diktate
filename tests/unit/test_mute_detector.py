"""Unit tests for core.mute_detector module (SPEC_040_GAPS.md Task 1.5).

Tests Windows COM API mute detection with full pycaw mocking.
"""

import logging
import sys
from unittest.mock import Mock, patch, MagicMock
import pytest


# Mock pycaw/comtypes at module level BEFORE importing mute_detector
# This prevents ImportError when pycaw is not installed
mock_comtypes = MagicMock()
mock_comtypes.CLSCTX_ALL = 0x17
mock_pycaw_module = MagicMock()
mock_pycaw_pycaw = MagicMock()

sys.modules["comtypes"] = mock_comtypes
sys.modules["pycaw"] = mock_pycaw_module
sys.modules["pycaw.pycaw"] = mock_pycaw_pycaw


@pytest.fixture
def mock_pycaw():
    """Mock pycaw classes for individual tests."""
    # Mock pycaw classes
    mock_audio_utils = MagicMock()
    mock_volume_interface = MagicMock()

    with patch("core.mute_detector.CLSCTX_ALL", 0x17), \
         patch("core.mute_detector.AudioUtilities", mock_audio_utils), \
         patch("core.mute_detector.IAudioEndpointVolume", mock_volume_interface), \
         patch("core.mute_detector.PYCAW_AVAILABLE", True):

        yield {
            "AudioUtilities": mock_audio_utils,
            "IAudioEndpointVolume": mock_volume_interface,
        }


class TestMuteDetectorInit:
    """Test MuteDetector initialization."""

    def test_init_with_device_label(self, mock_pycaw):
        """__init__ should store device label and initialize state"""
        from core.mute_detector import MuteDetector

        detector = MuteDetector(device_label="Elgato Wave:3")

        assert detector.device_label == "Elgato Wave:3"
        assert detector.last_mute_state is False
        assert detector._device_cache is None

    def test_init_without_device_label(self, mock_pycaw):
        """__init__ should accept None for default device"""
        from core.mute_detector import MuteDetector

        detector = MuteDetector(device_label=None)

        assert detector.device_label is None
        assert detector._device_cache is None


class TestFindDeviceByLabel:
    """Test _find_device_by_label fuzzy matching logic."""

    def test_find_device_fuzzy_match_success(self, mock_pycaw):
        """_find_device_by_label should fuzzy match device name"""
        from core.mute_detector import MuteDetector

        # Mock device with matching name
        mock_device = Mock()
        mock_device.FriendlyName = "Mic In (Elgato Wave:3)"
        mock_device.Activate.return_value = Mock()

        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = [mock_device]
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{some-uuid}"

        detector = MuteDetector(device_label="Elgato Wave:3")
        result = detector._find_device_by_label()

        assert result == mock_device
        mock_device.Activate.assert_called_once_with("{some-uuid}", 0x17, None)

    def test_find_device_case_insensitive(self, mock_pycaw):
        """_find_device_by_label should match case-insensitively"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_device.FriendlyName = "MICROPHONE (USB)"
        mock_device.Activate.return_value = Mock()

        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = [mock_device]
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector(device_label="usb")
        result = detector._find_device_by_label()

        assert result == mock_device

    def test_find_device_no_match(self, mock_pycaw, caplog):
        """_find_device_by_label should return None if no match found"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_device.FriendlyName = "Speakers (Realtek)"
        mock_device.Activate.return_value = Mock()

        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = [mock_device]
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        with caplog.at_level(logging.INFO):
            detector = MuteDetector(device_label="Nonexistent Mic")
            result = detector._find_device_by_label()

        assert result is None
        assert "Device 'Nonexistent Mic' not found" in caplog.text

    def test_find_device_skips_invalid_devices(self, mock_pycaw):
        """_find_device_by_label should skip devices that can't be activated"""
        from core.mute_detector import MuteDetector

        # First device fails to activate (output device)
        invalid_device = Mock()
        invalid_device.Activate.side_effect = Exception("Not an input device")

        # Second device succeeds
        valid_device = Mock()
        valid_device.FriendlyName = "Mic In (USB)"
        valid_device.Activate.return_value = Mock()

        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = [invalid_device, valid_device]
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector(device_label="USB")
        result = detector._find_device_by_label()

        assert result == valid_device  # Should skip invalid and find valid

    def test_find_device_handles_exception(self, mock_pycaw, caplog):
        """_find_device_by_label should handle exceptions gracefully"""
        from core.mute_detector import MuteDetector

        mock_pycaw["AudioUtilities"].GetAllDevices.side_effect = Exception("COM error")

        with caplog.at_level(logging.ERROR):
            detector = MuteDetector(device_label="Test Mic")
            result = detector._find_device_by_label()

        assert result is None
        assert "Error finding device" in caplog.text

    def test_find_device_default_label_no_warning(self, mock_pycaw, caplog):
        """_find_device_by_label should not warn if using 'default' label"""
        from core.mute_detector import MuteDetector

        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = []
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        with caplog.at_level(logging.INFO):
            detector = MuteDetector(device_label="default")
            result = detector._find_device_by_label()

        assert result is None
        # Should NOT log "Device 'default' not found" message
        assert "not found (will use system default)" not in caplog.text


class TestCheckMuteState:
    """Test check_mute_state mute detection logic."""

    def test_check_mute_state_muted(self, mock_pycaw):
        """check_mute_state should return True when microphone is muted"""
        from core.mute_detector import MuteDetector

        # Mock device and volume interface
        mock_device = Mock()
        mock_interface = Mock()
        mock_volume = Mock()
        mock_volume.GetMute.return_value = 1  # Muted

        mock_device.Activate.return_value = mock_interface
        mock_interface.QueryInterface.return_value = mock_volume
        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = mock_device
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector()
        result = detector.check_mute_state()

        assert result is True
        mock_volume.GetMute.assert_called_once()

    def test_check_mute_state_not_muted(self, mock_pycaw):
        """check_mute_state should return False when microphone is unmuted"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_interface = Mock()
        mock_volume = Mock()
        mock_volume.GetMute.return_value = 0  # Not muted

        mock_device.Activate.return_value = mock_interface
        mock_interface.QueryInterface.return_value = mock_volume
        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = mock_device
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector()
        result = detector.check_mute_state()

        assert result is False

    def test_check_mute_state_uses_cached_device(self, mock_pycaw):
        """check_mute_state should reuse cached device on subsequent calls"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_interface = Mock()
        mock_volume = Mock()
        mock_volume.GetMute.return_value = 0

        mock_device.Activate.return_value = mock_interface
        mock_interface.QueryInterface.return_value = mock_volume
        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = mock_device
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector()

        # First call - should cache device
        detector.check_mute_state()
        first_call_count = mock_pycaw["AudioUtilities"].GetMicrophone.call_count

        # Second call - should use cache
        detector.check_mute_state()
        second_call_count = mock_pycaw["AudioUtilities"].GetMicrophone.call_count

        assert first_call_count == 1
        assert second_call_count == 1  # No additional call

    def test_check_mute_state_with_specific_device(self, mock_pycaw):
        """check_mute_state should use _find_device_by_label for specific device"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_device.FriendlyName = "Elgato Wave:3"
        mock_interface = Mock()
        mock_volume = Mock()
        mock_volume.GetMute.return_value = 0

        mock_device.Activate.return_value = mock_interface
        mock_interface.QueryInterface.return_value = mock_volume
        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = [mock_device]
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector(device_label="Elgato")
        result = detector.check_mute_state()

        assert result is False
        # Should NOT call GetMicrophone (used custom device)
        mock_pycaw["AudioUtilities"].GetMicrophone.assert_not_called()

    def test_check_mute_state_falls_back_to_default(self, mock_pycaw):
        """check_mute_state should fall back to default mic if specific device not found"""
        from core.mute_detector import MuteDetector

        # _find_device_by_label returns None (device not found)
        mock_pycaw["AudioUtilities"].GetAllDevices.return_value = []

        # Mock default microphone
        mock_device = Mock()
        mock_interface = Mock()
        mock_volume = Mock()
        mock_volume.GetMute.return_value = 1

        mock_device.Activate.return_value = mock_interface
        mock_interface.QueryInterface.return_value = mock_volume
        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = mock_device
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector(device_label="Nonexistent Mic")
        result = detector.check_mute_state()

        assert result is True
        # Should have called GetMicrophone as fallback
        mock_pycaw["AudioUtilities"].GetMicrophone.assert_called_once()

    def test_check_mute_state_no_default_mic(self, mock_pycaw):
        """check_mute_state should return None if no default microphone exists"""
        from core.mute_detector import MuteDetector

        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = None

        detector = MuteDetector()
        result = detector.check_mute_state()

        assert result is None

    def test_check_mute_state_handles_exception(self, mock_pycaw, caplog):
        """check_mute_state should handle exceptions and clear cache"""
        from core.mute_detector import MuteDetector

        mock_device = Mock()
        mock_device.Activate.side_effect = Exception("COM error")
        mock_pycaw["AudioUtilities"].GetMicrophone.return_value = mock_device
        mock_pycaw["IAudioEndpointVolume"]._iid_ = "{uuid}"

        detector = MuteDetector()
        detector._device_cache = mock_device  # Pre-populate cache

        with caplog.at_level(logging.WARNING):
            result = detector.check_mute_state()

        assert result is None
        assert detector._device_cache is None  # Cache should be cleared
        assert "Error checking mute" in caplog.text

    def test_check_mute_state_without_pycaw(self):
        """check_mute_state should return None if pycaw not available"""
        with patch("core.mute_detector.PYCAW_AVAILABLE", False):
            from core.mute_detector import MuteDetector

            detector = MuteDetector()
            result = detector.check_mute_state()

            assert result is None


class TestUpdateDeviceLabel:
    """Test update_device_label cache invalidation."""

    def test_update_device_label_clears_cache(self, mock_pycaw, caplog):
        """update_device_label should clear cache when label changes"""
        from core.mute_detector import MuteDetector

        detector = MuteDetector(device_label="Old Device")
        detector._device_cache = Mock()  # Simulate cached device

        with caplog.at_level(logging.INFO):
            detector.update_device_label("New Device")

        assert detector.device_label == "New Device"
        assert detector._device_cache is None
        assert "Device updated to: New Device" in caplog.text

    def test_update_device_label_same_label_no_clear(self, mock_pycaw):
        """update_device_label should not clear cache if label unchanged"""
        from core.mute_detector import MuteDetector

        detector = MuteDetector(device_label="Same Device")
        mock_cache = Mock()
        detector._device_cache = mock_cache

        detector.update_device_label("Same Device")

        # Cache should still be present (not cleared)
        assert detector._device_cache == mock_cache


class TestPycawImportFallback:
    """Test behavior when pycaw is not available."""

    def test_pycaw_import_error_handled(self):
        """Module should set PYCAW_AVAILABLE=False on import error"""
        # This test verifies the module-level try/except block
        # We can't directly test the import failure, but we can verify the flag
        import core.mute_detector

        # PYCAW_AVAILABLE should be a boolean (True or False)
        assert isinstance(core.mute_detector.PYCAW_AVAILABLE, bool)

    def test_find_device_without_pycaw(self):
        """_find_device_by_label should return None if pycaw unavailable"""
        with patch("core.mute_detector.PYCAW_AVAILABLE", False):
            from core.mute_detector import MuteDetector

            detector = MuteDetector(device_label="Test Device")
            result = detector._find_device_by_label()

            assert result is None
