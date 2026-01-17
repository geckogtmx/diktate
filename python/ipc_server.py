"""
IPC Server for dIKtate
Handles JSON-based communication between Electron and Python backend
"""

import sys
import json
import threading
import logging
import time
from enum import Enum
from pathlib import Path
from typing import Optional, Dict
from pynput import keyboard

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent))

from core import Recorder, Transcriber, Processor, Injector

# Configure logging
log_dir = Path(Path.home()) / ".diktate" / "logs"
log_dir.mkdir(parents=True, exist_ok=True)

# Build handlers list - StreamHandler only in debug mode to avoid leaking transcripts
import os
log_handlers = [logging.FileHandler(log_dir / "diktate.log")]
if os.environ.get("DEBUG") == "1":
    log_handlers.append(logging.StreamHandler())

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=log_handlers
)
logger = logging.getLogger(__name__)


class State(Enum):
    """Pipeline states"""
    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    INJECTING = "injecting"
    ERROR = "error"


class PerformanceMetrics:
    """Track performance metrics for the pipeline"""

    def __init__(self):
        self.metrics: Dict[str, float] = {}
        self.start_times: Dict[str, float] = {}

    def start(self, metric_name: str) -> None:
        """Start timing a metric"""
        self.start_times[metric_name] = time.time()

    def end(self, metric_name: str) -> float:
        """End timing a metric and return duration"""
        if metric_name not in self.start_times:
            logger.warning(f"Attempted to end non-existent metric: {metric_name}")
            return 0.0

        duration = (time.time() - self.start_times[metric_name]) * 1000  # Convert to ms
        self.metrics[metric_name] = duration
        del self.start_times[metric_name]

        logger.info(f"[PERF] {metric_name}: {duration:.0f}ms")
        return duration

    def get_metrics(self) -> Dict[str, float]:
        """Get all recorded metrics"""
        return self.metrics.copy()

    def reset(self) -> None:
        """Reset all metrics"""
        self.metrics.clear()
        self.start_times.clear()


class IpcServer:
    """Server for handling IPC commands from Electron"""

    def __init__(self):
        """Initialize the IPC server"""
        self.state = State.IDLE
        self.recorder: Optional[Recorder] = None
        self.transcriber: Optional[Transcriber] = None
        self.processor: Optional[Processor] = None
        self.injector: Optional[Injector] = None
        self.recording = False
        self.audio_file = None
        self.perf = PerformanceMetrics()

        logger.info("Initializing IPC Server...")
        self._initialize_components()
        logger.info("IPC Server initialized successfully")

    def _initialize_components(self) -> None:
        """Initialize all pipeline components"""
        try:
            self.recorder = Recorder()
            logger.info("[OK] Recorder initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Recorder: {e}")
            self._send_error(f"Recorder initialization failed: {e}")

        try:
            # Default to Turbo for speed (V3)
            self.transcriber = Transcriber(model_size="turbo", device="auto")
            logger.info("[OK] Transcriber initialized (Turbo V3)")
        except Exception as e:
            logger.error(f"Failed to initialize Transcriber: {e}")
            self._send_error(f"Transcriber initialization failed: {e}")

        try:
            self.processor = Processor()
            logger.info("[OK] Processor initialized (Ollama connected)")
        except Exception as e:
            logger.error(f"Failed to initialize Processor: {e}")
            logger.warning("Text processing will skip Ollama if unavailable")

        try:
            self.injector = Injector()
            logger.info(f"[OK] Injector initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Injector: {e}")
            self._send_error(f"Injector initialization failed: {e}")


    def _set_state(self, new_state: State) -> None:
        """Set pipeline state and emit event"""
        logger.info(f"State transition: {self.state.value} -> {new_state.value}")
        self.state = new_state
        self._emit_event("state-change", {"state": new_state.value})

    def start_recording(self) -> dict:
        """Start recording audio"""
        if self.state != State.IDLE:
            error_msg = f"Cannot start recording in {self.state.value} state"
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}

        try:
            # Reset metrics for new session
            self.perf.reset()
            self.perf.start("total")
            self.perf.start("recording")

            self._set_state(State.RECORDING)
            self.recorder.start()
            self.recording = True
            logger.info("[REC] Recording started")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            self._set_state(State.ERROR)
            return {"success": False, "error": str(e)}

    def stop_recording(self) -> dict:
        """Stop recording and process the audio"""
        if self.state != State.RECORDING:
            error_msg = f"Cannot stop recording in {self.state.value} state"
            logger.warning(error_msg)
            return {"success": False, "error": error_msg}

        self.recording = False
        try:
            self.recorder.stop()
            self.perf.end("recording")
            logger.info("[STOP] Recording stopped")

            # Save audio to temporary file
            import os
            self.audio_file = os.path.join(self.recorder.temp_dir, "recording.wav")
            self.recorder.save_to_file(self.audio_file)

            # Process the recording in a background thread
            thread = threading.Thread(target=self._process_recording)
            thread.start()

            return {"success": True}

        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            self._set_state(State.ERROR)
            return {"success": False, "error": str(e)}

    def _process_recording(self) -> None:
        """Process the recorded audio through the pipeline"""
        try:
            self._set_state(State.PROCESSING)

            # Transcribe
            logger.info("[TRANSCRIBE] Transcribing audio...")
            self.perf.start("transcription")
            raw_text = self.transcriber.transcribe(self.audio_file)
            self.perf.end("transcription")
            logger.info(f"[RESULT] Transcribed: {raw_text}")

            if not raw_text or not raw_text.strip():
                logger.info("[PROCESS] Empty transcription, skipping processing and injection")
                self._set_state(State.IDLE)
                return

            # Process (clean up text)
            logger.info("[PROCESS] Processing text...")
            self.perf.start("processing")
            if self.processor:
                processed_text = self.processor.process(raw_text)
            else:
                processed_text = raw_text
            self.perf.end("processing")
            logger.info(f"[RESULT] Processed: {processed_text}")

            # Inject text
            self._set_state(State.INJECTING)
            logger.info("[INJECT] Injecting text...")
            self.perf.start("injection")
            self.injector.type_text(processed_text)
            self.perf.end("injection")
            logger.info("[SUCCESS] Text injected successfully")

            # End total timing and log all metrics
            self.perf.end("total")
            metrics = self.perf.get_metrics()
            logger.info(f"[PERF] Session complete - Total: {metrics.get('total', 0):.0f}ms")
            self._emit_event("performance-metrics", metrics)

            # Cleanup
            if self.audio_file:
                try:
                    import os
                    os.remove(self.audio_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary audio file: {e}")

            self._set_state(State.IDLE)

        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            self._set_state(State.ERROR)

    def configure(self, config: dict) -> dict:
        """Configure the pipeline (switch models, etc)"""
        try:
            model_size = config.get("model")
            if model_size:
                logger.info(f"[CONFIG] Switching model to: {model_size}")
                # Re-initialize transcriber
                self.transcriber = Transcriber(model_size=model_size, device="auto")
                return {"success": True, "message": f"Switched to {model_size}"}
            return {"success": False, "error": "No valid configuration found"}
        except Exception as e:
            logger.error(f"Configuration failed: {e}")
            return {"success": False, "error": str(e)}

    def handle_command(self, command: dict) -> dict:
        """Handle a command from Electron"""
        try:
            cmd_name = command.get("command")
            cmd_id = command.get("id", "unknown")

            logger.info(f"[CMD] Received command: {cmd_name} (id: {cmd_id})")

            if cmd_name == "start_recording":
                return self.start_recording()
            elif cmd_name == "stop_recording":
                return self.stop_recording()
            elif cmd_name == "status":
                return {"success": True, "state": self.state.value}
            elif cmd_name == "configure":
                return self.configure(command.get("config", {}))
            elif cmd_name == "shutdown":
                logger.info("[CMD] Shutdown requested")
                return {"success": True}
            else:
                return {"success": False, "error": f"Unknown command: {cmd_name}"}

        except Exception as e:
            logger.error(f"Error handling command: {e}")
            return {"success": False, "error": str(e)}

    def _emit_event(self, event_type: str, data: dict) -> None:
        """Emit an event to Electron"""
        event = {"event": event_type, **data}
        self._send_json(event)

    def _send_error(self, error_msg: str) -> None:
        """Send error event to Electron"""
        self._emit_event("error", {"message": error_msg})

    def _send_json(self, data: dict) -> None:
        """Send JSON data to stdout"""
        try:
            json_str = json.dumps(data)
            print(json_str, flush=True)
        except Exception as e:
            logger.error(f"Failed to send JSON: {e}")

    def run(self) -> None:
        """Run the IPC server"""
        try:
            logger.info("=" * 60)
            logger.info("dIKtate IPC Server is running")
            logger.info("Waiting for commands from Electron...")
            logger.info("=" * 60)

            # Read commands from stdin
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue

                try:
                    command = json.loads(line)
                    response = self.handle_command(command)

                    # Send response
                    response["id"] = command.get("id")
                    self._send_json(response)

                    # Check for shutdown
                    if command.get("command") == "shutdown":
                        break

                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
                    self._send_error(f"Invalid JSON: {e}")
                except Exception as e:
                    logger.error(f"Error processing command: {e}")
                    self._send_error(f"Error: {e}")

        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt, shutting down...")
        except Exception as e:
            logger.error(f"Runtime error: {e}")
        finally:
            self.shutdown()

    def shutdown(self) -> None:
        """Clean up and shutdown"""
        logger.info("Shutting down IPC Server...")

        if self.recording and self.recorder:
            try:
                self.recorder.stop()
            except Exception as e:
                logger.warning(f"Error stopping recorder: {e}")

        if hasattr(self, 'listener') and self.listener:
            self.listener.stop()

        logger.info("IPC Server shutdown complete")
        sys.exit(0)


if __name__ == "__main__":
    server = IpcServer()
    server.run()
