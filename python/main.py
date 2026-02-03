"""Main orchestration script for dIKtate."""

import logging
import os
import sys
import time
from enum import Enum
from pathlib import Path

from pynput import keyboard

# Add core module to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging - Session-based log files
from datetime import datetime

from core import Injector, Processor, Recorder, Transcriber

log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Create session-specific log file with timestamp
session_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
session_log_file = log_dir / f"diktate_{session_timestamp}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(session_log_file), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)
logger.info(f"Session log: {session_log_file}")


class State(Enum):
    """Pipeline states."""

    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    INJECTING = "injecting"
    ERROR = "error"


class DiktatePipeline:
    """Main orchestration pipeline for dIKtate."""

    # Hotkey configuration for push-to-talk (Ctrl+Shift+Space)
    # Will be initialized in setup_hotkey_listener()

    def __init__(self):
        """Initialize the pipeline."""
        self.state = State.IDLE
        self.recorder: Recorder | None = None
        self.transcriber: Transcriber | None = None
        self.processor: Processor | None = None
        self.injector: Injector | None = None
        self.listener: keyboard.Listener | None = None
        self.recording = False
        self.audio_file = None

        logger.info("Initializing dIKtate pipeline...")
        self._initialize_components()
        logger.info("Pipeline initialized successfully")

    def _initialize_components(self) -> None:
        """Initialize all pipeline components."""
        try:
            self.recorder = Recorder()
            logger.info("[OK] Recorder initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Recorder: {e}")
            raise

        try:
            self.transcriber = Transcriber(model_size="medium", device="auto")
            logger.info(
                "[OK] Transcriber initialized (this may take a moment for first-time model download...)"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Transcriber: {e}")
            raise

        try:
            self.processor = Processor()
            logger.info("[OK] Processor initialized (Ollama connection verified)")
        except Exception as e:
            logger.error(f"Failed to initialize Processor: {e}")
            logger.warning("Text processing will skip Ollama if unavailable")

        try:
            self.injector = Injector()
            logger.info("[OK] Injector initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Injector: {e}")
            raise

    def _set_state(self, new_state: State) -> None:
        """Set pipeline state and log transition."""
        logger.info(f"State transition: {self.state.value} -> {new_state.value}")
        self.state = new_state

    def start_recording(self) -> None:
        """Start recording audio."""
        if self.state != State.IDLE:
            logger.warning(f"Cannot start recording in {self.state.value} state")
            return

        self._set_state(State.RECORDING)
        try:
            self.recorder.start()
            self.recording = True
            logger.info("[REC] Recording started - speak now")
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            self._set_state(State.ERROR)

    def stop_recording(self) -> None:
        """Stop recording and process the audio."""
        if self.state != State.RECORDING:
            logger.warning(f"Cannot stop recording in {self.state.value} state")
            return

        self.recording = False
        try:
            self.recorder.stop()
            logger.info("[STOP] Recording stopped")

            # Save audio to temporary file
            self.audio_file = os.path.join(self.recorder.temp_dir, "recording.wav")
            self.recorder.save_to_file(self.audio_file)

            # Process the recording
            self._process_recording()

        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            self._set_state(State.ERROR)

    def _process_recording(self) -> None:
        """Process the recorded audio through the pipeline."""
        try:
            self._set_state(State.PROCESSING)

            # Transcribe
            logger.info("[TRANSCRIBE] Transcribing audio...")
            raw_text = self.transcriber.transcribe(self.audio_file)
            logger.info(f"[RESULT] Transcribed: {raw_text}")

            # Process (clean up text)
            logger.info("[PROCESS] Processing text...")
            if self.processor:
                processed_text = self.processor.process(raw_text)
            else:
                processed_text = raw_text

            # Log side-by-side comparison for tuning
            logger.info(
                "\n"
                + "=" * 40
                + "\n[COMPARISON]\n"
                + f"RAW:      {raw_text}\n"
                + f"CLEANED:  {processed_text}\n"
                + "=" * 40
            )

            # Inject text
            self._set_state(State.INJECTING)
            logger.info("[INJECT] Injecting text...")
            self.injector.type_text(processed_text)
            logger.info("[SUCCESS] Text injected successfully")

            # Cleanup
            if self.audio_file and os.path.exists(self.audio_file):
                try:
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            self._set_state(State.ERROR)

    def on_hotkey_pressed(self) -> None:
        """Handle hotkey press (start recording)."""
        if self.state == State.IDLE:
            self.start_recording()

    def on_hotkey_released(self) -> None:
        """Handle hotkey release (stop recording)."""
        if self.state == State.RECORDING:
            self.stop_recording()

    def setup_hotkey_listener(self) -> None:
        """Setup global hotkey listener for Ctrl+Shift+Space."""
        try:
            # Track key states
            self.pressed_keys = set()

            def on_press(key):
                """Handle key press."""
                try:
                    self.pressed_keys.add(key)
                    # Check for Ctrl+Alt+D combination
                    # Note: Alt is Key.alt_l or Key.alt_r
                    if (
                        (
                            keyboard.Key.ctrl_l in self.pressed_keys
                            or keyboard.Key.ctrl_r in self.pressed_keys
                        )
                        and (
                            keyboard.Key.alt_l in self.pressed_keys
                            or keyboard.Key.alt_r in self.pressed_keys
                        )
                        and getattr(key, "char", None) == "d"
                    ):
                        self.on_hotkey_pressed()
                except AttributeError:
                    pass

            def on_release(key):
                """Handle key release."""
                try:
                    # Remove key from pressed set
                    if key in self.pressed_keys:
                        self.pressed_keys.remove(key)

                    # Stop recording if D is released (for PTT)
                    # Or should we wait for modifiers?
                    # Simpler PTT: If we are recording, and the main trigger key (D) is released, stop.
                    if getattr(key, "char", None) == "d":
                        self.on_hotkey_released()
                except AttributeError:
                    pass

            # Create and start listener
            self.listener = keyboard.Listener(on_press=on_press, on_release=on_release)
            self.listener.start()
            logger.info("Global hotkey listener started (Ctrl+Shift+Space)")
        except Exception as e:
            logger.error(f"Failed to setup hotkey listener: {e}")
            raise

    def run(self) -> None:
        """Run the pipeline in listening mode."""
        try:
            logger.info("=" * 60)
            logger.info("dIKtate is running")
            logger.info("Press Ctrl+Shift+Space to start recording")
            logger.info("Release to stop and process")
            logger.info("=" * 60)

            self.setup_hotkey_listener()

            # Keep the process running
            while True:
                time.sleep(0.1)

        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt, shutting down...")
            self.shutdown()
        except Exception as e:
            logger.error(f"Runtime error: {e}")
            self.shutdown()

    def shutdown(self) -> None:
        """Clean up and shutdown."""
        logger.info("Shutting down dIKtate...")

        if self.listener:
            self.listener.stop()

        if self.recording and self.recorder:
            try:
                self.recorder.stop()
            except Exception as e:
                logger.warning(f"Error stopping recorder: {e}")

        logger.info("dIKtate shutdown complete")
        sys.exit(0)


if __name__ == "__main__":
    pipeline = DiktatePipeline()
    pipeline.run()
