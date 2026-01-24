"""Microphone mute detection using Windows Core Audio API (pycaw)."""

import logging
import warnings
from typing import Optional

# Silence pycaw/comtypes deprecation warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pycaw")

try:
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    PYCAW_AVAILABLE = True
except ImportError:
    PYCAW_AVAILABLE = False

logger = logging.getLogger(__name__)


class MuteDetector:
    """Detects mute state of a specific audio input device."""

    def __init__(self, device_label: Optional[str] = None):
        """
        Initialize mute detector for a specific device.

        Args:
            device_label: Device name to monitor (e.g., "Mic In (Elgato Wave:3)")
                         If None, monitors system default microphone
        """
        self.device_label = device_label
        self.last_mute_state = False
        self._device_cache = None

    def _find_device_by_label(self):
        """Find audio device by fuzzy label match."""
        if not PYCAW_AVAILABLE:
            return None

        try:
            devices = AudioUtilities.GetAllDevices()

            for device in devices:
                # Check if it's an input device
                try:
                    interface = device.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                    # If we can activate volume interface, it's a valid device

                    # Fuzzy match on label
                    device_name = str(device.FriendlyName)
                    if self.device_label and self.device_label.lower() in device_name.lower():
                        logger.info(f"[MUTE_DETECTOR] Matched device: {device_name}")
                        return device

                except Exception:
                    continue  # Not an input device or can't query

            # Match failed
            is_default = not self.device_label or self.device_label.lower() in ["default", "default microphone"]
            if not is_default:
                logger.info(f"[MUTE_DETECTOR] Device '{self.device_label}' not found (will use system default)")
            return None

        except Exception as e:
            logger.error(f"[MUTE_DETECTOR] Error finding device: {e}")
            return None

    def check_mute_state(self) -> Optional[bool]:
        """
        Check if the microphone is muted.

        Returns:
            True if muted, False if not muted, None if unable to determine
        """
        if not PYCAW_AVAILABLE:
            return None

        try:
            # Use cached device or find new one
            if self._device_cache is None:
                self._device_cache = self._find_device_by_label()

            if self._device_cache is None:
                # Fall back to system default if specific device not found
                default_mic = AudioUtilities.GetMicrophone()
                if default_mic is None:
                    return None
                self._device_cache = default_mic

            # Query mute state
            interface = self._device_cache.Activate(
                IAudioEndpointVolume._iid_, CLSCTX_ALL, None
            )
            volume = interface.QueryInterface(IAudioEndpointVolume)
            mute_state = volume.GetMute()

            return bool(mute_state)

        except Exception as e:
            logger.warning(f"[MUTE_DETECTOR] Error checking mute: {e}")
            self._device_cache = None  # Clear cache, retry next time
            return None

    def update_device_label(self, new_label: str):
        """Update monitored device (clears cache)."""
        if new_label != self.device_label:
            self.device_label = new_label
            self._device_cache = None  # Force re-discovery
            logger.info(f"[MUTE_DETECTOR] Device updated to: {new_label}")
